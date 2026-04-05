/**
 * One-time migration: encrypt existing plaintext PII data in profiles and conversations.
 *
 * Usage: npx tsx scripts/encrypt-existing-data.ts
 *
 * Requires POSTGRES_URL and ENCRYPTION_KEY (or AUTH_SECRET) environment variables.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { profiles, conversations } from "../app/lib/db/schema";
import { encrypt } from "../app/lib/db/encryption";

const url = process.env.POSTGRES_URL;
if (!url) {
  console.error("POSTGRES_URL not set");
  process.exit(1);
}

const sql = neon(url);
const db = drizzle(sql);

function isEncrypted(value: string): boolean {
  // Encrypted values have format: iv:tag:ciphertext (hex strings separated by colons)
  return /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/.test(value);
}

async function migrateProfiles() {
  const rows = await db.select().from(profiles);
  let migrated = 0;

  for (const row of rows) {
    // Skip if already encrypted
    if (isEncrypted(row.birthDate)) {
      console.log(`  Profile ${row.id} (${row.label}) — already encrypted, skipping`);
      continue;
    }

    const set: Record<string, unknown> = {};
    if (row.birthDate) set.birthDate = encrypt(row.birthDate);
    if (row.birthTime) set.birthTime = encrypt(row.birthTime);
    if (row.gender) set.gender = encrypt(row.gender);
    if (row.birthPlace) set.birthPlace = encrypt(row.birthPlace);
    if (row.savedCharts) set.savedCharts = encrypt(JSON.stringify(row.savedCharts));

    if (Object.keys(set).length > 0) {
      await db.update(profiles).set(set).where(eq(profiles.id, row.id));
      migrated++;
      console.log(`  Profile ${row.id} (${row.label}) — encrypted`);
    }
  }

  console.log(`Profiles: ${migrated}/${rows.length} migrated`);
}

async function migrateConversations() {
  const rows = await db.select().from(conversations);
  let migrated = 0;

  for (const row of rows) {
    // Skip if already encrypted
    if (isEncrypted(row.userQuestion)) {
      console.log(`  Conversation ${row.id} — already encrypted, skipping`);
      continue;
    }

    const set: Record<string, unknown> = {};
    if (row.userQuestion) set.userQuestion = encrypt(row.userQuestion);
    if (row.aiResponse) set.aiResponse = encrypt(row.aiResponse);
    if (row.aiReasoning) set.aiReasoning = encrypt(row.aiReasoning);

    if (Object.keys(set).length > 0) {
      await db.update(conversations).set(set).where(eq(conversations.id, row.id));
      migrated++;
      console.log(`  Conversation ${row.id} — encrypted`);
    }
  }

  console.log(`Conversations: ${migrated}/${rows.length} migrated`);
}

async function main() {
  console.log("=== Encrypting existing PII data ===\n");

  console.log("Migrating profiles...");
  await migrateProfiles();

  console.log("\nMigrating conversations...");
  await migrateConversations();

  console.log("\n=== Done ===");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
