import { eq } from "drizzle-orm";
import { db } from "@/app/lib/db";
import { integrationSettings } from "@/app/lib/db/schema";
import { encrypt, decrypt } from "@/app/lib/db/encryption";

export interface IntegrationConfig {
  service: string;
  apiUrl: string;
  apiKey: string;
  enabled: boolean;
  metadata: Record<string, unknown> | null;
}

export interface IntegrationInput {
  service: string;
  apiUrl: string;
  apiKey: string;        // plaintext; encrypted on write
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export async function getIntegration(service: string): Promise<IntegrationConfig | null> {
  const rows = await db
    .select()
    .from(integrationSettings)
    .where(eq(integrationSettings.service, service))
    .limit(1);
  if (!rows.length) return null;
  const row = rows[0];
  let apiKey = "";
  try {
    apiKey = decrypt(row.apiKeyEncrypted);
  } catch (e) {
    console.error(`[integration-settings] decrypt failed for ${service}:`, e);
  }
  return {
    service: row.service,
    apiUrl: row.apiUrl,
    apiKey,
    enabled: row.enabled,
    metadata: (row.metadata as Record<string, unknown>) ?? null,
  };
}

export async function upsertIntegration(input: IntegrationInput): Promise<void> {
  const encryptedKey = input.apiKey ? encrypt(input.apiKey) : "";
  await db
    .insert(integrationSettings)
    .values({
      service: input.service,
      apiUrl: input.apiUrl,
      apiKeyEncrypted: encryptedKey,
      enabled: input.enabled ?? false,
      metadata: input.metadata ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: integrationSettings.service,
      set: {
        apiUrl: input.apiUrl,
        apiKeyEncrypted: encryptedKey,
        enabled: input.enabled ?? false,
        metadata: input.metadata ?? null,
        updatedAt: new Date(),
      },
    });
}

export async function deleteIntegration(service: string): Promise<void> {
  await db.delete(integrationSettings).where(eq(integrationSettings.service, service));
}

export async function listIntegrations(): Promise<IntegrationConfig[]> {
  const rows = await db.select().from(integrationSettings);
  return rows.map((row) => {
    let apiKey = "";
    try {
      apiKey = decrypt(row.apiKeyEncrypted);
    } catch (e) {
      console.error(`[integration-settings] decrypt failed for ${row.service}:`, e);
    }
    return {
      service: row.service,
      apiUrl: row.apiUrl,
      apiKey,
      enabled: row.enabled,
      metadata: (row.metadata as Record<string, unknown>) ?? null,
    };
  });
}
