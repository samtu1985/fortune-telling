import { NextRequest } from "next/server";
import { auth } from "@/app/lib/auth";
import { ADMIN_EMAIL } from "@/app/lib/users";
import { db } from "@/app/lib/db";
import { apiUsage, users } from "@/app/lib/db/schema";
import { gte, sql, and, eq, ne } from "drizzle-orm";

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
    // LLM per-user (everything except TTS provider)
    const llmRows = await db
      .select({
        userEmail: apiUsage.userEmail,
        calls: sql<number>`count(*)::int`,
        inputTokens: sql<number>`coalesce(sum(${apiUsage.inputTokens}), 0)::int`,
        outputTokens: sql<number>`coalesce(sum(${apiUsage.outputTokens}), 0)::int`,
        models: sql<string>`string_agg(distinct ${apiUsage.modelId}, ',')`,
      })
      .from(apiUsage)
      .where(and(gte(apiUsage.createdAt, since), ne(apiUsage.provider, "elevenlabs")))
      .groupBy(apiUsage.userEmail)
      .orderBy(sql`count(*) desc`);

    // TTS per-user (elevenlabs only)
    const ttsRows = await db
      .select({
        userEmail: apiUsage.userEmail,
        calls: sql<number>`count(*)::int`,
        characters: sql<number>`coalesce(sum(${apiUsage.inputTokens}), 0)::int`,
        models: sql<string>`string_agg(distinct ${apiUsage.modelId}, ',')`,
      })
      .from(apiUsage)
      .where(and(gte(apiUsage.createdAt, since), eq(apiUsage.provider, "elevenlabs")))
      .groupBy(apiUsage.userEmail);

    // User directory for names/avatars
    const allUsers = await db
      .select({ email: users.email, name: users.name, image: users.image })
      .from(users);
    const userMap = new Map(allUsers.map((u) => [u.email, u]));

    type ByUser = {
      email: string;
      name: string | null;
      image: string | null;
      calls: number;
      inputTokens: number;
      outputTokens: number;
      models: Record<string, number>;
      tts: { calls: number; characters: number; models: string[] } | null;
    };

    const byEmail = new Map<string, ByUser>();

    // Seed from LLM rows
    for (const r of llmRows) {
      const u = userMap.get(r.userEmail);
      const modelList = (r.models || "").split(",").filter(Boolean);
      const models: Record<string, number> = {};
      for (const m of modelList) models[m] = (models[m] || 0) + 1;
      byEmail.set(r.userEmail, {
        email: r.userEmail,
        name: u?.name || null,
        image: u?.image || null,
        calls: r.calls,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        models,
        tts: null,
      });
    }

    // Merge TTS rows (may create new entries for TTS-only users)
    for (const r of ttsRows) {
      let entry = byEmail.get(r.userEmail);
      if (!entry) {
        const u = userMap.get(r.userEmail);
        entry = {
          email: r.userEmail,
          name: u?.name || null,
          image: u?.image || null,
          calls: 0,
          inputTokens: 0,
          outputTokens: 0,
          models: {},
          tts: null,
        };
        byEmail.set(r.userEmail, entry);
      }
      entry.tts = {
        calls: r.calls,
        characters: r.characters,
        models: (r.models || "").split(",").filter(Boolean),
      };
    }

    // Sort: users with any activity; primary key = LLM calls desc, tiebreak by TTS calls desc
    const byUser = Array.from(byEmail.values()).sort((a, b) => {
      if (b.calls !== a.calls) return b.calls - a.calls;
      return (b.tts?.calls ?? 0) - (a.tts?.calls ?? 0);
    });

    // Totals (LLM only — TTS numbers are shown per-user, not at top)
    let totalCalls = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    for (const u of byUser) {
      totalCalls += u.calls;
      totalInputTokens += u.inputTokens;
      totalOutputTokens += u.outputTokens;
    }

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
