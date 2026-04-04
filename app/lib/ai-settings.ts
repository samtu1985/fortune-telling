import fs from "fs/promises";
import path from "path";

export interface MasterAIConfig {
  provider: string;    // e.g. "byteplus", "openai", "google", "anthropic", "custom"
  modelId: string;     // e.g. "gpt-4o", "claude-sonnet-4-0"
  apiKey: string;      // provider API key
  apiUrl: string;      // endpoint URL
  // Anthropic thinking
  thinkingMode?: "adaptive" | "enabled" | "disabled";
  effort?: "low" | "medium" | "high" | "max";  // for adaptive thinking (4.6 models)
  thinkingBudget?: number;  // budget_tokens for older models
  // BytePlus reasoning
  reasoningDepth?: "high" | "medium" | "low" | "off";
}

// Settings keyed by master type: "bazi", "ziwei", "zodiac", "single-bazi", "single-ziwei", "single-zodiac"
export type AISettingsStore = Record<string, MasterAIConfig>;

const BLOB_PATH = "ai-settings.json";
const LOCAL_FILE = path.join(process.cwd(), "data", "ai-settings.json");

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

function useBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export async function readAISettings(): Promise<AISettingsStore> {
  if (useBlob()) {
    try {
      const { head } = await import("@vercel/blob");
      const meta = await head(BLOB_PATH);
      const token = process.env.BLOB_READ_WRITE_TOKEN!;
      const url = new URL(meta.url);
      url.searchParams.set("t", Date.now().toString());
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Blob fetch failed: ${res.status}`);
      }
      return await res.json();
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "BlobNotFoundError") {
        return {};
      }
      console.error("[ai-settings] Failed to read from Blob:", e instanceof Error ? e.message : e);
      throw e;
    }
  }

  try {
    const data = await fs.readFile(LOCAL_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export async function writeAISettings(settings: AISettingsStore): Promise<void> {
  if (useBlob()) {
    const { put } = await import("@vercel/blob");
    await put(BLOB_PATH, JSON.stringify(settings, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return;
  }

  const dir = path.dirname(LOCAL_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(LOCAL_FILE, JSON.stringify(settings, null, 2), "utf-8");
}

/**
 * Get the AI config for a specific master/mode.
 * Falls back to env-based BytePlus config if no setting exists.
 */
export async function getAIConfig(key: string): Promise<MasterAIConfig> {
  try {
    const settings = await readAISettings();
    if (settings[key]) {
      return settings[key];
    }
  } catch {
    // Fall through to default
  }

  // Default: use env-based BytePlus config
  return {
    provider: "byteplus",
    modelId: process.env.BYTEPLUS_MODEL_ID || "seed-2-0-pro-260328",
    apiKey: process.env.BYTEPLUS_API_KEY || "",
    apiUrl: "https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions",
  };
}
