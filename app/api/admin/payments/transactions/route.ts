import { requireAdmin } from "@/app/lib/admin-guard";
import { db } from "@/app/lib/db";
import { purchases, paymentPackages, users } from "@/app/lib/db/schema";
import { or, ilike, desc, asc, sql, eq } from "drizzle-orm";

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const sort = url.searchParams.get("sort") ?? "time";
  const dir = url.searchParams.get("dir") ?? "desc";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const pageSize = 25;

  const sortCol =
    sort === "amount"
      ? purchases.amount
      : sort === "user"
        ? users.email
        : purchases.createdAt;
  const orderBy = dir === "asc" ? asc(sortCol) : desc(sortCol);

  const qFilter = q
    ? or(
        ilike(users.email, `%${q}%`),
        ilike(paymentPackages.name, `%${q}%`),
        ilike(purchases.stripeSessionId, `%${q}%`),
      )
    : undefined;

  const rows = await db
    .select({
      id: purchases.id,
      createdAt: purchases.createdAt,
      userEmail: users.email,
      userId: users.id,
      packageName: paymentPackages.name,
      amount: purchases.amount,
      currency: purchases.currency,
      status: purchases.status,
      stripeSessionId: purchases.stripeSessionId,
      stripePaymentIntentId: purchases.stripePaymentIntentId,
    })
    .from(purchases)
    .leftJoin(users, eq(purchases.userId, users.id))
    .leftJoin(paymentPackages, eq(purchases.packageId, paymentPackages.id))
    .where(qFilter)
    .orderBy(orderBy)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(purchases)
    .leftJoin(users, eq(purchases.userId, users.id))
    .leftJoin(paymentPackages, eq(purchases.packageId, paymentPackages.id))
    .where(qFilter);

  return Response.json({
    rows,
    total: Number(total),
    page,
    pageSize,
  });
}
