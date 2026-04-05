import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { ttsSettings, ttsVoices } from "./db/schema";
import { encrypt, decrypt } from "./db/encryption";

export interface TTSConfig {
  apiKey: string;
  modelId: string;
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
}

export interface TTSVoiceMap {
  [masterKey: string]: { [locale: string]: string };
}

export async function getTTSConfig(): Promise<TTSConfig | null> {
  const rows = await db.select().from(ttsSettings).limit(1);
  if (!rows[0] || !rows[0].apiKeyEncrypted) return null;

  return {
    apiKey: decrypt(rows[0].apiKeyEncrypted),
    modelId: rows[0].modelId,
    stability: rows[0].stability,
    similarityBoost: rows[0].similarityBoost,
    style: rows[0].style,
    speed: rows[0].speed,
  };
}

export async function getTTSSettingsForAdmin(): Promise<{
  hasKey: boolean;
  modelId: string;
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
} | null> {
  const rows = await db.select().from(ttsSettings).limit(1);
  if (!rows[0]) return null;

  return {
    hasKey: !!rows[0].apiKeyEncrypted,
    modelId: rows[0].modelId,
    stability: rows[0].stability,
    similarityBoost: rows[0].similarityBoost,
    style: rows[0].style,
    speed: rows[0].speed,
  };
}

export async function saveTTSSettings(config: {
  apiKey?: string;
  modelId: string;
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
}): Promise<void> {
  const existing = await db.select().from(ttsSettings).limit(1);

  const set: Record<string, unknown> = {
    modelId: config.modelId,
    stability: config.stability,
    similarityBoost: config.similarityBoost,
    style: config.style,
    speed: config.speed,
    updatedAt: new Date(),
  };

  if (config.apiKey) {
    set.apiKeyEncrypted = encrypt(config.apiKey);
  }

  if (existing[0]) {
    await db.update(ttsSettings).set(set).where(eq(ttsSettings.id, existing[0].id));
  } else {
    await db.insert(ttsSettings).values({
      apiKeyEncrypted: config.apiKey ? encrypt(config.apiKey) : "",
      modelId: config.modelId,
      stability: config.stability,
      similarityBoost: config.similarityBoost,
      style: config.style,
      speed: config.speed,
    });
  }
}

export async function getVoiceId(masterKey: string, locale: string): Promise<string | null> {
  const row = await db
    .select({ voiceId: ttsVoices.voiceId })
    .from(ttsVoices)
    .where(and(eq(ttsVoices.masterKey, masterKey), eq(ttsVoices.locale, locale)))
    .limit(1);
  return row[0]?.voiceId || null;
}

export async function getAllVoices(): Promise<TTSVoiceMap> {
  const rows = await db.select().from(ttsVoices);
  const map: TTSVoiceMap = {};
  for (const row of rows) {
    if (!map[row.masterKey]) map[row.masterKey] = {};
    map[row.masterKey][row.locale] = row.voiceId;
  }
  return map;
}

export async function saveVoice(masterKey: string, locale: string, voiceId: string): Promise<void> {
  const existing = await db
    .select()
    .from(ttsVoices)
    .where(and(eq(ttsVoices.masterKey, masterKey), eq(ttsVoices.locale, locale)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(ttsVoices)
      .set({ voiceId })
      .where(eq(ttsVoices.id, existing[0].id));
  } else {
    await db.insert(ttsVoices).values({ masterKey, locale, voiceId });
  }
}
