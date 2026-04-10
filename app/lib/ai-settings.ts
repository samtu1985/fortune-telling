import { eq } from "drizzle-orm";
import { db } from "./db";
import { aiSettings } from "./db/schema";
import { encrypt, decrypt } from "./db/encryption";

export interface MasterAIConfig {
  provider: string;
  modelId: string;
  apiKey: string;
  apiUrl: string;
  // Anthropic thinking
  thinkingMode?: "adaptive" | "enabled" | "disabled";
  effort?: "low" | "medium" | "high" | "max";
  thinkingBudget?: number;
  // BytePlus reasoning
  reasoningDepth?: "high" | "medium" | "low" | "off";
}

export type AISettingsStore = Record<string, MasterAIConfig>;

// Well-known providers with default endpoints
export const PROVIDERS: Record<string, { label: string; defaultUrl: string; defaultModel: string }> = {
  byteplus: {
    label: "BytePlus (Seed)",
    defaultUrl: "https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions",
    defaultModel: "seed-2-0-pro-260328",
  },
  openai: {
    label: "OpenAI",
    defaultUrl: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o",
  },
  anthropic: {
    label: "Anthropic (Claude)",
    defaultUrl: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-sonnet-4-0",
  },
  google: {
    label: "Google (Gemini)",
    defaultUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    defaultModel: "gemini-2.5-flash",
  },
  custom: {
    label: "自訂 (OpenAI 相容)",
    defaultUrl: "",
    defaultModel: "",
  },
};

export async function readAISettings(): Promise<AISettingsStore> {
  const rows = await db.select().from(aiSettings);
  const store: AISettingsStore = {};
  for (const row of rows) {
    let apiKey = "";
    try {
      apiKey = decrypt(row.apiKeyEncrypted);
    } catch (e) {
      console.error(`[ai-settings] Failed to decrypt key for ${row.masterKey}:`, e);
    }
    store[row.masterKey] = {
      provider: row.provider,
      modelId: row.modelId,
      apiKey,
      apiUrl: row.apiUrl,
      thinkingMode: row.thinkingMode as MasterAIConfig["thinkingMode"],
      effort: row.effort as MasterAIConfig["effort"],
      thinkingBudget: row.thinkingBudget ?? undefined,
      reasoningDepth: row.reasoningDepth as MasterAIConfig["reasoningDepth"],
    };
  }
  return store;
}

export async function writeAISettings(settings: AISettingsStore): Promise<void> {
  // Upsert each entry individually (atomic per key)
  for (const [key, config] of Object.entries(settings)) {
    await upsertAISetting(key, config);
  }
}

/**
 * Upsert a single AI setting entry by master key.
 * Prefer this over writeAISettings when updating a single entry
 * to avoid re-encrypting (and potentially corrupting) other entries.
 */
export async function upsertAISetting(key: string, config: MasterAIConfig): Promise<void> {
  await db
    .insert(aiSettings)
    .values({
      masterKey: key,
      provider: config.provider,
      modelId: config.modelId,
      apiKeyEncrypted: encrypt(config.apiKey),
      apiUrl: config.apiUrl,
      thinkingMode: config.thinkingMode ?? null,
      effort: config.effort ?? null,
      thinkingBudget: config.thinkingBudget ?? null,
      reasoningDepth: config.reasoningDepth ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: aiSettings.masterKey,
      set: {
        provider: config.provider,
        modelId: config.modelId,
        apiKeyEncrypted: encrypt(config.apiKey),
        apiUrl: config.apiUrl,
        thinkingMode: config.thinkingMode ?? null,
        effort: config.effort ?? null,
        thinkingBudget: config.thinkingBudget ?? null,
        reasoningDepth: config.reasoningDepth ?? null,
        updatedAt: new Date(),
      },
    });
}

export async function deleteAISetting(key: string): Promise<void> {
  await db.delete(aiSettings).where(eq(aiSettings.masterKey, key));
}

/**
 * Get the AI config for a specific master/mode.
 * Falls back to env-based BytePlus config if no setting exists.
 */
export async function getAIConfig(key: string): Promise<MasterAIConfig> {
  try {
    const row = await db.select().from(aiSettings).where(eq(aiSettings.masterKey, key)).limit(1);
    if (row[0]) {
      return {
        provider: row[0].provider,
        modelId: row[0].modelId,
        apiKey: decrypt(row[0].apiKeyEncrypted),
        apiUrl: row[0].apiUrl,
        thinkingMode: row[0].thinkingMode as MasterAIConfig["thinkingMode"],
        effort: row[0].effort as MasterAIConfig["effort"],
        thinkingBudget: row[0].thinkingBudget ?? undefined,
        reasoningDepth: row[0].reasoningDepth as MasterAIConfig["reasoningDepth"],
      };
    }
  } catch (e) {
    console.error(`[ai-settings] Failed to load config for ${key}:`, e);
    // Fall through to default
  }

  return {
    provider: "google",
    modelId: process.env.GOOGLE_MODEL_ID || "gemini-2.5-flash",
    apiKey: process.env.GOOGLE_API_KEY || "",
    apiUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  };
}
