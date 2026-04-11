import { requireAdmin } from "@/app/lib/admin-guard";
import { requireStripe } from "@/app/lib/stripe";
import { db } from "@/app/lib/db";
import { purchases } from "@/app/lib/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const days = Math.min(
    30,
    Math.max(1, parseInt(url.searchParams.get("days") ?? "7")),
  );
  const sinceDate = new Date(Date.now() - days * 86400_000);
  const sinceUnix = Math.floor(sinceDate.getTime() / 1000);

  const [local] = await db
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(amount), 0)::int`,
    })
    .from(purchases)
    .where(and(eq(purchases.status, "paid"), gte(purchases.createdAt, sinceDate)));

  let stripeSide = { count: 0, total: 0 };
  let error: string | null = null;
  try {
    const stripe = requireStripe();
    // Use charges.list, not balanceTransactions.list. Balance transactions
    // only appear after funds actually move into the account's balance,
    // which for delayed-payout accounts can be days after the charge. The
    // local `purchases WHERE status='paid'` query matches "charge succeeded",
    // so query succeeded charges to compare like-for-like.
    const charges = await stripe.charges.list({
      created: { gte: sinceUnix },
      limit: 100,
    });
    // Exclude fully-refunded charges to match how the local table filters
    // out purchases.status='refunded'. Partial refunds are intentionally
    // ignored on both sides (spec §9.5).
    const succeeded = charges.data.filter(
      (c) => c.status === "succeeded" && !c.refunded,
    );
    stripeSide = {
      count: succeeded.length,
      total: succeeded.reduce((sum, c) => sum + c.amount, 0),
    };
  } catch (e) {
    error = e instanceof Error ? e.message : "unknown";
  }

  return Response.json({
    local: { count: Number(local.count), total: Number(local.total) },
    stripe: stripeSide,
    match:
      !error &&
      Number(local.count) === stripeSide.count &&
      Number(local.total) === stripeSide.total,
    days,
    error,
  });
}
