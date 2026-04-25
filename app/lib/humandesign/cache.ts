import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/app/lib/db";
import { humandesignCache } from "@/app/lib/db/schema";
import type { HumanDesignChartData, HumanDesignInput } from "./types";

/**
 * Compute the cache key for a (date, time, city, calendarType) tuple.
 * IMPORTANT: pass the SOLAR date — lunar→solar conversion must happen
 * before this so e.g. lunar 1990-01-01 (Jan 27 solar) and direct solar
 * 1990-01-27 share the same cache.
 */
export function computeCacheKey(input: HumanDesignInput): string {
  const canonical = [
    input.date.trim(),
    input.time.trim(),
    input.city.trim().toLowerCase(),
    input.timezone?.trim() ?? "",
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

export async function getCachedChart(key: string): Promise<HumanDesignChartData | null> {
  const rows = await db
    .select({ data: humandesignCache.chartData })
    .from(humandesignCache)
    .where(eq(humandesignCache.cacheKey, key))
    .limit(1);
  if (!rows[0]?.data) return null;
  // Touch last_used_at asynchronously; don't block the read.
  void db
    .update(humandesignCache)
    .set({ lastUsedAt: new Date() })
    .where(eq(humandesignCache.cacheKey, key));
  return rows[0].data as HumanDesignChartData;
}

export async function getCachedImage(key: string): Promise<Uint8Array | null> {
  const rows = await db
    .select({ b64: humandesignCache.imageBase64 })
    .from(humandesignCache)
    .where(eq(humandesignCache.cacheKey, key))
    .limit(1);
  if (!rows[0]?.b64) return null;
  void db
    .update(humandesignCache)
    .set({ lastUsedAt: new Date() })
    .where(eq(humandesignCache.cacheKey, key));
  return new Uint8Array(Buffer.from(rows[0].b64, "base64"));
}

export async function setCachedChart(key: string, chart: HumanDesignChartData): Promise<void> {
  await db
    .insert(humandesignCache)
    .values({
      cacheKey: key,
      chartData: chart as unknown as Record<string, unknown>,
      lastUsedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: humandesignCache.cacheKey,
      set: { chartData: chart as unknown as Record<string, unknown>, lastUsedAt: new Date() },
    });
}

export async function setCachedImage(key: string, bytes: Uint8Array | ArrayBuffer): Promise<void> {
  const b64 = Buffer.from(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes).toString("base64");
  await db
    .insert(humandesignCache)
    .values({
      cacheKey: key,
      imageBase64: b64,
      lastUsedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: humandesignCache.cacheKey,
      set: { imageBase64: b64, lastUsedAt: new Date() },
    });
}
