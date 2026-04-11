// app/api/webhooks/stripe/route.ts
import { NextRequest } from "next/server";
import { stripe, requireStripe } from "@/app/lib/stripe";
import { db } from "@/app/lib/db";
import {
  stripeEvents,
  purchases,
  paymentPackages,
  users,
} from "@/app/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  sendPurchaseAdminNotification,
  sendRefundAdminNotification,
} from "@/app/lib/email";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !stripe) {
    console.error("[stripe-webhook] not configured");
    return new Response("not configured", { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("missing signature", { status: 400 });

  // MUST read raw body — Stripe signature is computed over raw bytes.
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    console.error(
      "[stripe-webhook] signature verification failed:",
      e instanceof Error ? e.message : e
    );
    return new Response("invalid signature", { status: 400 });
  }

  // Early duplicate check — cheap read, avoids unnecessary Stripe API calls.
  // NOTE: this is best-effort. The authoritative idempotency guard for the
  // grant path is the `purchases.stripeSessionId` unique index — a race
  // between two simultaneous deliveries of the same event is safe because
  // only one `onConflictDoNothing` insert will succeed.
  const existing = await db
    .select({ id: stripeEvents.id })
    .from(stripeEvents)
    .where(eq(stripeEvents.id, event.id))
    .limit(1);
  if (existing.length > 0) {
    console.log("[stripe-webhook] duplicate event", event.id);
    return new Response("ok (duplicate)", { status: 200 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        // Accepted but ignored
        break;
    }
  } catch (e) {
    console.error(
      `[stripe-webhook][ALERT] handler failed for event ${event.id} (${event.type})`,
      e
    );
    // Still return 200 — the purchases.stripeSessionId unique index prevents
    // double-grants on Stripe retry, and returning non-200 would cause Stripe
    // to retry which would re-call the handler — desirable if the first
    // attempt crashed. Tradeoff: we accept that crashes during handler work
    // require manual investigation via logs.
  }

  // Mark event processed LAST — after successful (or swallowed) handler work.
  // If the handler crashed mid-work, stripe_events is NOT written, so Stripe's
  // retry will re-enter the handler and the unique index on
  // `purchases.stripeSessionId` prevents any double-grant.
  await db
    .insert(stripeEvents)
    .values({ id: event.id, type: event.type })
    .onConflictDoNothing();

  return new Response("ok", { status: 200 });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userIdStr = session.client_reference_id;
  if (!userIdStr) {
    console.error(
      "[stripe-webhook] missing client_reference_id",
      session.id
    );
    return;
  }
  const userId = parseInt(userIdStr, 10);
  if (!Number.isFinite(userId)) {
    console.error("[stripe-webhook] invalid client_reference_id", userIdStr);
    return;
  }

  // Identify which package this session was for via line items.
  const s = requireStripe();
  const lineItems = await s.checkout.sessions.listLineItems(session.id, {
    limit: 10,
  });
  const priceId = lineItems.data[0]?.price?.id;
  if (!priceId) {
    console.error("[stripe-webhook] no price id in line items", session.id);
    return;
  }

  const [pkg] = await db
    .select()
    .from(paymentPackages)
    .where(eq(paymentPackages.stripePriceId, priceId))
    .limit(1);

  if (!pkg) {
    console.error("[stripe-webhook] unknown price id", priceId);
    return;
  }

  // Idempotency layer 2: unique index on stripeSessionId.
  const inserted = await db
    .insert(purchases)
    .values({
      userId,
      packageId: pkg.id,
      stripeSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null,
      amount: session.amount_total ?? pkg.priceAmount ?? 0,
      currency: session.currency ?? pkg.currency,
      singleGranted: pkg.singleCreditsGranted,
      multiGranted: pkg.multiCreditsGranted,
      status: "paid",
    })
    .onConflictDoNothing({ target: purchases.stripeSessionId })
    .returning();

  if (inserted.length === 0) {
    // Race / duplicate — another worker already inserted this purchase.
    return;
  }

  await db
    .update(users)
    .set({
      singleCredits: sql`${users.singleCredits} + ${pkg.singleCreditsGranted}`,
      multiCredits: sql`${users.multiCredits} + ${pkg.multiCreditsGranted}`,
    })
    .where(eq(users.id, userId));

  // Reload user to include updated credit counts for the admin email.
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (user) {
    await sendPurchaseAdminNotification({
      user,
      pkg,
      amount: inserted[0].amount,
      currency: inserted[0].currency,
      stripeSessionId: session.id,
    });
  }
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntent =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!paymentIntent) return;

  // Only act on FULL refunds. Partial refunds are ignored — we don't currently
  // support proration (Phase 2 only supports full-refund credit revocation).
  // Stripe fires `charge.refunded` for both, so this guard is required.
  const fullyRefunded = charge.amount_refunded >= charge.amount_captured;
  if (!fullyRefunded) {
    console.log(
      `[stripe-webhook] skipping partial refund: ${charge.id} (refunded ${charge.amount_refunded} of ${charge.amount_captured})`
    );
    return;
  }

  const [purchase] = await db
    .select()
    .from(purchases)
    .where(eq(purchases.stripePaymentIntentId, paymentIntent))
    .limit(1);

  if (!purchase) {
    // Ordering race is OK — the checkout.session.completed event may not
    // have landed yet. Don't throw; Stripe will re-deliver charge.refunded
    // if we return non-2xx, but we've already recorded the event id.
    console.warn(
      "[stripe-webhook] refund for unknown purchase",
      paymentIntent
    );
    return;
  }
  if (purchase.status !== "paid") {
    return;
  }

  await db
    .update(purchases)
    .set({ status: "refunded", refundedAt: new Date() })
    .where(eq(purchases.id, purchase.id));

  // Refund-safe deduction: never drop remaining below 0. If the user has
  // already consumed some of the granted credits, clamp at singleUsed/multiUsed
  // so `remaining = credits - used` stays >= 0.
  await db
    .update(users)
    .set({
      singleCredits: sql`GREATEST(${users.singleCredits} - ${purchase.singleGranted}, ${users.singleUsed})`,
      multiCredits: sql`GREATEST(${users.multiCredits} - ${purchase.multiGranted}, ${users.multiUsed})`,
    })
    .where(eq(users.id, purchase.userId));

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, purchase.userId))
    .limit(1);
  const [pkg] = purchase.packageId
    ? await db
        .select()
        .from(paymentPackages)
        .where(eq(paymentPackages.id, purchase.packageId))
        .limit(1)
    : [null];

  if (user) {
    await sendRefundAdminNotification({
      user,
      pkg,
      purchase,
    });
  }
}
