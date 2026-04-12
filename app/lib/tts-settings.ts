import { eq, and, asc } from "drizzle-orm";
import { db } from "./db";
import { ttsSettings, ttsVoices, ttsPronunciationRules } from "./db/schema";
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

// ─── TTS pronunciation rules ─────────────────────────────

export interface TTSPronunciationRule {
  id: number;
  pattern: string;
  replacement: string;
  note: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Active rules for the TTS pipeline to apply before sending text to
 * ElevenLabs. Only returns the minimal data needed to run replacements.
 */
export async function getActiveTTSReplacements(): Promise<
  Array<{ pattern: string; replacement: string }>
> {
  const rows = await db
    .select({
      pattern: ttsPronunciationRules.pattern,
      replacement: ttsPronunciationRules.replacement,
    })
    .from(ttsPronunciationRules)
    .where(eq(ttsPronunciationRules.isActive, true))
    .orderBy(asc(ttsPronunciationRules.sortOrder));
  return rows;
}

/**
 * Full row set for the admin UI. Includes inactive rules and metadata.
 */
export async function listTTSPronunciationRules(): Promise<TTSPronunciationRule[]> {
  const rows = await db
    .select()
    .from(ttsPronunciationRules)
    .orderBy(asc(ttsPronunciationRules.sortOrder));
  return rows.map((r) => ({
    id: r.id,
    pattern: r.pattern,
    replacement: r.replacement,
    note: r.note,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function createTTSPronunciationRule(input: {
  pattern: string;
  replacement: string;
  note?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}): Promise<TTSPronunciationRule> {
  const [row] = await db
    .insert(ttsPronunciationRules)
    .values({
      pattern: input.pattern,
      replacement: input.replacement,
      note: input.note ?? null,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return {
    id: row.id,
    pattern: row.pattern,
    replacement: row.replacement,
    note: row.note,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function updateTTSPronunciationRule(
  id: number,
  updates: Partial<{
    pattern: string;
    replacement: string;
    note: string | null;
    isActive: boolean;
    sortOrder: number;
  }>
): Promise<boolean> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.pattern !== undefined) set.pattern = updates.pattern;
  if (updates.replacement !== undefined) set.replacement = updates.replacement;
  if (updates.note !== undefined) set.note = updates.note;
  if (updates.isActive !== undefined) set.isActive = updates.isActive;
  if (updates.sortOrder !== undefined) set.sortOrder = updates.sortOrder;

  const result = await db
    .update(ttsPronunciationRules)
    .set(set)
    .where(eq(ttsPronunciationRules.id, id));
  return (result.rowCount ?? 0) > 0;
}

export async function deleteTTSPronunciationRule(id: number): Promise<boolean> {
  const result = await db
    .delete(ttsPronunciationRules)
    .where(eq(ttsPronunciationRules.id, id));
  return (result.rowCount ?? 0) > 0;
}
