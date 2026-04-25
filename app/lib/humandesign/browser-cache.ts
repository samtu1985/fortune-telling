// Browser-side cache for Human Design chart + bodygraph PNG.
//
// Server already caches by birth-data hash (humandesign_cache table), so even
// without this layer the user's humandesignhub credits stay at 0 on repeats.
// What this layer saves: the ~200ms round-trip + decode flicker when switching
// between divination modes during a single browsing session. Typical usage:
// 5–10 cached birth profiles per device; each entry ~210KB (chart JSON + base64 PNG).
// localStorage quota is ~5–10MB so capping at MAX_ENTRIES is sufficient.

import type { HumanDesignChartData } from "./types";

const STORAGE_PREFIX = "hd-cache:";
const MAX_ENTRIES = 10;

export interface BrowserCachedEntry {
  chart: HumanDesignChartData;
  imageBase64: string; // PNG bytes as base64
  timestamp: number;
}

export interface BirthInfoLike {
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  calendarType?: "solar" | "lunar";
  isLunar?: boolean;
}

/**
 * SHA-256 of canonical birth params. Same key → same chart, regardless of
 * lunar/solar input form (lunar conversion happens server-side; including
 * the calendar flag here keeps client-side keys deterministic — different
 * calendar input yields different cache rows even if they'd resolve to the
 * same solar date server-side, which is acceptable: the server fetches once
 * per (calendar-type, date) combo and the cache transparently fills both).
 */
export async function computeBrowserCacheKey(birth: BirthInfoLike): Promise<string> {
  const isLunar = birth.isLunar ?? birth.calendarType === "lunar";
  const canonical = [
    birth.birthDate.trim(),
    birth.birthTime.trim(),
    birth.birthPlace.trim().toLowerCase(),
    isLunar ? "lunar" : "solar",
  ].join("|");
  const buf = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getCachedEntry(key: string): BrowserCachedEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BrowserCachedEntry;
    if (!parsed.chart || !parsed.imageBase64) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setCachedEntry(key: string, entry: BrowserCachedEntry): void {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify(entry);
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, payload);
    enforceLruCap();
  } catch {
    // QuotaExceededError or similar — purge oldest 5 then retry once
    pruneOldest(5);
    try {
      window.localStorage.setItem(STORAGE_PREFIX + key, payload);
    } catch {
      // Give up silently — server cache + a fresh fetch still works
    }
  }
}

function listCacheEntries(): Array<{ storageKey: string; ts: number }> {
  const out: Array<{ storageKey: string; ts: number }> = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k || !k.startsWith(STORAGE_PREFIX)) continue;
    try {
      const v = JSON.parse(window.localStorage.getItem(k) ?? "{}");
      out.push({ storageKey: k, ts: typeof v.timestamp === "number" ? v.timestamp : 0 });
    } catch {
      // Treat unparseable entries as oldest so they're evicted first.
      out.push({ storageKey: k, ts: 0 });
    }
  }
  return out;
}

function enforceLruCap(): void {
  const entries = listCacheEntries();
  if (entries.length <= MAX_ENTRIES) return;
  entries.sort((a, b) => a.ts - b.ts);
  for (const e of entries.slice(0, entries.length - MAX_ENTRIES)) {
    window.localStorage.removeItem(e.storageKey);
  }
}

function pruneOldest(n: number): void {
  const entries = listCacheEntries();
  entries.sort((a, b) => a.ts - b.ts);
  for (const e of entries.slice(0, n)) {
    window.localStorage.removeItem(e.storageKey);
  }
}

/** Convert ArrayBuffer → base64 in chunks (avoid stack overflow on >64KB). */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000; // 32KB chunks; well under JS engine arg-count limits
  for (let i = 0; i < bytes.byteLength; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  return btoa(binary);
}

/** Convert base64 → Uint8Array. */
export function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
