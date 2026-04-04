import { NextRequest } from "next/server";
import { auth } from "@/app/lib/auth";
import { ADMIN_EMAIL } from "@/app/lib/users";
import { db } from "@/app/lib/db";
import { apiUsage, users } from "@/app/lib/db/schema";
import { gte, sql } from "drizzle-orm";

const RANGE_DAYS: Record<string, number> = {
  "1d": 1,
  "1w": 7,
  "1m": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365,
};

async function checkAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.email === ADMIN_EMAIL;
}

export async function GET(request: NextRequest) {
  if (!(await checkAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const range = request.nextUrl.searchParams.get("range") || "1m";
  const days = RANGE_DAYS[range] || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    // Aggregate by user
    const rows = await db
      .select({
        userEmail: apiUsage.userEmail,
        calls: sql<number>`count(*)::int`,
        inputTokens: sql<number>`coalesce(sum(${apiUsage.inputTokens}), 0)::int`,
        outputTokens: sql<number>`coalesce(sum(${apiUsage.outputTokens}), 0)::int`,
        models: sql<string>`string_agg(distinct ${apiUsage.modelId}, ',')`,
      })
      .from(apiUsage)
      .where(gte(apiUsage.createdAt, since))
      .groupBy(apiUsage.userEmail)
      .orderBy(sql`count(*) desc`);

    // Get user names
    const allUsers = await db
      .select({ email: users.email, name: users.name, image: users.image })
      .from(users);
    const userMap = new Map(allUsers.map((u) => [u.email, u]));

    let totalCalls = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const byUser = rows.map((row) => {
      totalCalls += row.calls;
      totalInputTokens += row.inputTokens;
      totalOutputTokens += row.outputTokens;

      const user = userMap.get(row.userEmail);
      const modelList = (row.models || "").split(",").filter(Boolean);
      const models: Record<string, number> = {};
      for (const m of modelList) {
        models[m] = (models[m] || 0) + 1;
      }

      return {
        email: row.userEmail,
        name: user?.name || null,
        image: user?.image || null,
        calls: row.calls,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        models,
      };
    });

    return Response.json({
      range,
      summary: { totalCalls, totalInputTokens, totalOutputTokens },
      byUser,
    });
  } catch (e) {
    console.error("[admin/usage] Failed:", e);
    return Response.json({ error: "Failed to query usage data" }, { status: 500 });
  }
}
