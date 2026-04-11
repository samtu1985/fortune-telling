import { requireAdmin } from "@/app/lib/admin-guard";
import { db } from "@/app/lib/db";
import { purchases } from "@/app/lib/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

type Range = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y";
const RANGE_MS: Record<Range, number> = {
  "1D": 86400_000,
  "1W": 7 * 86400_000,
  "1M": 30 * 86400_000,
  "3M": 90 * 86400_000,
  "6M": 180 * 86400_000,
  "1Y": 365 * 86400_000,
};
const BUCKET: Record<Range, "hour" | "day" | "week" | "month"> = {
  "1D": "hour",
  "1W": "day",
  "1M": "day",
  "3M": "week",
  "6M": "week",
  "1Y": "month",
};

function normalizeRows<T>(r: unknown): T[] {
  if (Array.isArray(r)) return r as T[];
  if (
    r &&
    typeof r === "object" &&
    "rows" in r &&
    Array.isArray((r as { rows: unknown[] }).rows)
  ) {
    return (r as { rows: T[] }).rows;
  }
  return [];
}

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const range = (url.searchParams.get("range") as Range) || "1M";
  if (!(range in RANGE_MS)) {
    return Response.json({ error: "invalid_range" }, { status: 400 });
  }

  const since = new Date(Date.now() - RANGE_MS[range]);
  const sinceIso = since.toISOString();

  // Four stat cards — aggregate over paid purchases in range
  const [aggRow] = await db
    .select({
      totalAmount: sql<number>`coalesce(sum(${purchases.amount}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(purchases)
    .where(and(eq(purchases.status, "paid"), gte(purchases.createdAt, since)));

  const totalAmount = Number(aggRow.totalAmount);
  const count = Number(aggRow.count);
  const avg = count > 0 ? Math.round(totalAmount / count) : 0;

  // New paying users: first paid purchase falls inside the window
  const [newUsersRow] = await db
    .select({
      count: sql<number>`count(distinct ${purchases.userId})::int`,
    })
    .from(purchases)
    .where(
      and(
        eq(purchases.status, "paid"),
        gte(purchases.createdAt, since),
        sql`${purchases.userId} NOT IN (
          SELECT user_id FROM purchases
          WHERE status = 'paid' AND created_at < ${sinceIso}
        )`,
      ),
    );

  // Line chart via date_trunc (raw SQL — drizzle builder has no portable date_trunc)
  const bucket = BUCKET[range];
  const lineChartRaw = await db.execute(sql`
    SELECT date_trunc(${bucket}, created_at) AS bucket,
           sum(amount)::int AS total,
           count(*)::int AS count
    FROM purchases
    WHERE status = 'paid' AND created_at >= ${sinceIso}
    GROUP BY bucket
    ORDER BY bucket ASC
  `);

  // Bar chart — per package share
  const barChartRaw = await db.execute(sql`
    SELECT p.package_id, pkg.name,
           sum(p.amount)::int AS total,
           count(*)::int AS count
    FROM purchases p
    LEFT JOIN payment_packages pkg ON pkg.id = p.package_id
    WHERE p.status = 'paid' AND p.created_at >= ${sinceIso}
    GROUP BY p.package_id, pkg.name
    ORDER BY total DESC
  `);

  return Response.json({
    range,
    cards: {
      totalAmount,
      count,
      avgOrderValue: avg,
      newPayingUsers: Number(newUsersRow.count),
    },
    lineChart: normalizeRows<{
      bucket: string;
      total: number;
      count: number;
    }>(lineChartRaw),
    barChart: normalizeRows<{
      package_id: number | null;
      name: string | null;
      total: number;
      count: number;
    }>(barChartRaw),
  });
}
