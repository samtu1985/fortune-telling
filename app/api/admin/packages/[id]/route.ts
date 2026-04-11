import { requireAdmin } from "@/app/lib/admin-guard";
import { db } from "@/app/lib/db";
import { paymentPackages, purchases } from "@/app/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const pkgId = parseInt(id);
  if (!Number.isFinite(pkgId)) {
    return Response.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = await req.json();
  const allowed = [
    "name",
    "description",
    "buyButtonId",
    "publishableKey",
    "stripePriceId",
    "priceAmount",
    "currency",
    "singleCreditsGranted",
    "multiCreditsGranted",
    "sortOrder",
    "isActive",
  ] as const;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of allowed) {
    if (k in body) updates[k] = body[k];
  }

  const [updated] = await db
    .update(paymentPackages)
    .set(updates)
    .where(eq(paymentPackages.id, pkgId))
    .returning();

  if (!updated) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json({ package: updated });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const pkgId = parseInt(id);
  if (!Number.isFinite(pkgId)) {
    return Response.json({ error: "invalid_id" }, { status: 400 });
  }

  const [ref] = await db
    .select({ id: purchases.id })
    .from(purchases)
    .where(eq(purchases.packageId, pkgId))
    .limit(1);

  if (ref) {
    return Response.json(
      {
        error: "package_in_use",
        message: "此方案有歷史交易，只能停用不能刪除",
      },
      { status: 409 }
    );
  }

  await db.delete(paymentPackages).where(eq(paymentPackages.id, pkgId));
  return Response.json({ ok: true });
}
