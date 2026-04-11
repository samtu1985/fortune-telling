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
    const txns = await stripe.balanceTransactions.list({
      created: { gte: sinceUnix },
      type: "charge",
      limit: 100,
    });
    stripeSide = {
      count: txns.data.length,
      total: txns.data.reduce((sum, t) => sum + t.amount, 0),
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
