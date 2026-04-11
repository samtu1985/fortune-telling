import { requireAdmin } from "@/app/lib/admin-guard";
import { db } from "@/app/lib/db";
import { purchases, users } from "@/app/lib/db/schema";
import { eq, sql } from "drizzle-orm";

type Status = "paid" | "refunded" | "failed";

function isStatus(v: unknown): v is Status {
  return v === "paid" || v === "refunded" || v === "failed";
}

/**
 * Deduct credits from a user using the same refund-safe math as the Stripe
 * webhook: never dip below the already-used count.
 */
async function deductCredits(
  userId: number,
  single: number,
  multi: number
): Promise<void> {
  if (single === 0 && multi === 0) return;
  await db
    .update(users)
    .set({
      singleCredits: sql`GREATEST(${users.singleCredits} - ${single}, ${users.singleUsed})`,
      multiCredits: sql`GREATEST(${users.multiCredits} - ${multi}, ${users.multiUsed})`,
    })
    .where(eq(users.id, userId));
}

async function addCredits(
  userId: number,
  single: number,
  multi: number
): Promise<void> {
  if (single === 0 && multi === 0) return;
  await db
    .update(users)
    .set({
      singleCredits: sql`${users.singleCredits} + ${single}`,
      multiCredits: sql`${users.multiCredits} + ${multi}`,
    })
    .where(eq(users.id, userId));
}

// PATCH: edit a transaction — currently only `status` is supported.
// Status transitions affect credits:
//   paid → refunded/failed  →  deduct granted credits
//   refunded/failed → paid  →  re-add granted credits
//   refunded ↔ failed       →  no credit change
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const purchaseId = parseInt(id);
  if (!Number.isFinite(purchaseId)) {
    return Response.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { status?: unknown };
  if (!isStatus(body.status)) {
    return Response.json({ error: "invalid_status" }, { status: 400 });
  }
  const nextStatus = body.status;

  const [row] = await db
    .select()
    .from(purchases)
    .where(eq(purchases.id, purchaseId))
    .limit(1);

  if (!row) return Response.json({ error: "not_found" }, { status: 404 });

  if (row.status === nextStatus) {
    return Response.json({ ok: true, unchanged: true });
  }

  // Credit adjustment
  const wasPaid = row.status === "paid";
  const willBePaid = nextStatus === "paid";

  if (wasPaid && !willBePaid) {
    await deductCredits(row.userId, row.singleGranted, row.multiGranted);
  } else if (!wasPaid && willBePaid) {
    await addCredits(row.userId, row.singleGranted, row.multiGranted);
  }

  await db
    .update(purchases)
    .set({
      status: nextStatus,
      refundedAt: nextStatus === "refunded" ? new Date() : null,
    })
    .where(eq(purchases.id, purchaseId));

  return Response.json({ ok: true });
}

// DELETE: remove a transaction row from the local ledger. If the row was
// in "paid" state, deduct the granted credits from the user (refund-safe).
// Primarily used for cleaning up test-mode webhook deliveries that leaked
// into the local ledger before live-mode rollout.
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const purchaseId = parseInt(id);
  if (!Number.isFinite(purchaseId)) {
    return Response.json({ error: "invalid_id" }, { status: 400 });
  }

  const [row] = await db
    .select()
    .from(purchases)
    .where(eq(purchases.id, purchaseId))
    .limit(1);

  if (!row) return Response.json({ error: "not_found" }, { status: 404 });

  if (row.status === "paid") {
    await deductCredits(row.userId, row.singleGranted, row.multiGranted);
  }

  await db.delete(purchases).where(eq(purchases.id, purchaseId));

  return Response.json({
    ok: true,
    deductedSingle: row.status === "paid" ? row.singleGranted : 0,
    deductedMulti: row.status === "paid" ? row.multiGranted : 0,
  });
}
