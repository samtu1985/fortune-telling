/**
 * One-time migration script: Vercel Blob → Postgres
 *
 * Usage: source <(grep -v '^#' .env.local | sed 's/^/export /') && npx tsx scripts/migrate-blob-to-pg.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { encrypt } from "../app/lib/db/encryption";
import * as schema from "../app/lib/db/schema";

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const POSTGRES_URL = process.env.POSTGRES_URL;

if (!POSTGRES_URL) {
  console.error("Missing POSTGRES_URL");
  process.exit(1);
}

const sql = neon(POSTGRES_URL);
const db = drizzle(sql, { schema });

async function readBlobFile(path: string): Promise<unknown> {
  if (!BLOB_TOKEN) {
    console.log(`  No BLOB_READ_WRITE_TOKEN, skipping ${path}`);
    return null;
  }

  try {
    const { head } = await import("@vercel/blob");
    const meta = await head(path, { token: BLOB_TOKEN });
    const url = new URL(meta.url);
    url.searchParams.set("t", Date.now().toString());
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${BLOB_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return await res.json();
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "BlobNotFoundError") {
      console.log(`  ${path} not found in blob, skipping`);
      return null;
    }
    throw e;
  }
}

interface BlobUserData {
  name: string | null;
  image: string | null;
  status: string;
  createdAt: string;
  approvedAt: string | null;
  reasoningDepth?: string;
  profile?: unknown;
  profiles?: Array<{
    id: string;
    label: string;
    birthDate: string;
    birthTime: string;
    gender: string;
    birthPlace: string;
    calendarType: string;
    isLeapMonth: boolean;
    savedCharts?: { bazi?: string; ziwei?: string; zodiac?: string };
    createdAt: string;
    updatedAt: string;
  }>;
  savedConversations?: Array<{
    id: string;
    type: string;
    userQuestion: string;
    aiResponse: string;
    aiReasoning?: string;
    profileLabel?: string;
    savedAt: string;
  }>;
}

interface BlobAIConfig {
  provider: string;
  modelId: string;
  apiKey: string;
  apiUrl: string;
  thinkingMode?: string;
  effort?: string;
  thinkingBudget?: number;
  reasoningDepth?: string;
}

async function main() {
  console.log("=== Blob → Postgres Migration ===\n");

  // ── 1. Migrate users ──────────────────────────────────
  console.log("1. Reading users.json from blob...");
  const usersData = (await readBlobFile("users.json")) as Record<string, BlobUserData> | null;

  let userCount = 0;
  let profileCount = 0;
  let convCount = 0;

  if (usersData) {
    const entries = Object.entries(usersData);
    console.log(`   Found ${entries.length} users`);

    for (const [email, data] of entries) {
      // Insert user
      const result = await db
        .insert(schema.users)
        .values({
          email,
          name: data.name,
          image: data.image,
          status: data.status || "pending",
          createdAt: new Date(data.createdAt),
          approvedAt: data.approvedAt ? new Date(data.approvedAt) : null,
        })
        .onConflictDoNothing()
        .returning();

      if (!result[0]) {
        console.log(`   Skipped ${email} (already exists)`);
        continue;
      }

      const userId = result[0].id;
      userCount++;

      // Insert profiles
      const profs = data.profiles || [];
      for (const p of profs) {
        await db
          .insert(schema.profiles)
          .values({
            id: p.id,
            userId,
            label: p.label,
            birthDate: p.birthDate,
            birthTime: p.birthTime,
            gender: p.gender,
            birthPlace: p.birthPlace,
            calendarType: p.calendarType || "solar",
            isLeapMonth: p.isLeapMonth || false,
            savedCharts: p.savedCharts ?? null,
            createdAt: new Date(p.createdAt),
            updatedAt: new Date(p.updatedAt),
          })
          .onConflictDoNothing();
        profileCount++;
      }

      // Insert conversations
      const convs = data.savedConversations || [];
      for (const c of convs) {
        await db
          .insert(schema.conversations)
          .values({
            id: c.id,
            userId,
            type: c.type,
            userQuestion: c.userQuestion,
            aiResponse: c.aiResponse,
            aiReasoning: c.aiReasoning ?? null,
            profileLabel: c.profileLabel ?? null,
            savedAt: new Date(c.savedAt),
          })
          .onConflictDoNothing();
        convCount++;
      }
    }
  }

  console.log(`   Migrated: ${userCount} users, ${profileCount} profiles, ${convCount} conversations\n`);

  // ── 2. Migrate AI settings ────────────────────────────
  console.log("2. Reading ai-settings.json from blob...");
  const aiData = (await readBlobFile("ai-settings.json")) as Record<string, BlobAIConfig> | null;

  let settingsCount = 0;

  if (aiData) {
    const entries = Object.entries(aiData);
    console.log(`   Found ${entries.length} AI settings`);

    for (const [key, config] of entries) {
      await db
        .insert(schema.aiSettings)
        .values({
          masterKey: key,
          provider: config.provider,
          modelId: config.modelId,
          apiKeyEncrypted: encrypt(config.apiKey || ""),
          apiUrl: config.apiUrl,
          thinkingMode: config.thinkingMode ?? null,
          effort: config.effort ?? null,
          thinkingBudget: config.thinkingBudget ?? null,
          reasoningDepth: config.reasoningDepth ?? null,
          updatedAt: new Date(),
        })
        .onConflictDoNothing();
      settingsCount++;
    }
  }

  console.log(`   Migrated: ${settingsCount} AI settings\n`);

  // ── 3. Verify ─────────────────────────────────────────
  console.log("3. Verification:");
  const uRows = await db.select().from(schema.users);
  const pRows = await db.select().from(schema.profiles);
  const cRows = await db.select().from(schema.conversations);
  const aRows = await db.select().from(schema.aiSettings);
  console.log(`   users: ${uRows.length}`);
  console.log(`   profiles: ${pRows.length}`);
  console.log(`   conversations: ${cRows.length}`);
  console.log(`   ai_settings: ${aRows.length}`);

  console.log("\n=== Migration complete ===");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
