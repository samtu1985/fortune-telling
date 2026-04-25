import { Lunar } from "lunar-typescript";
import { getIntegration } from "@/app/lib/integration-settings";
import { fetchBodygraph, fetchBodygraphImage, HumanDesignApiError } from "./client";
import { normalizeResponse } from "./normalize";
import {
  computeCacheKey,
  computeTransitCacheKey,
  getCachedChart,
  getCachedImage,
  setCachedChart,
  setCachedImage,
} from "./cache";
import type {
  HumanDesignChartData,
  HumanDesignInput,
  HumanDesignTransitData,
} from "./types";

export { HumanDesignApiError } from "./client";
export type {
  HumanDesignChartData,
  HumanDesignInput,
  HumanDesignTransitData,
} from "./types";

export interface GenerateChartOptions {
  calendarType?: "solar" | "lunar";
}

function convertLunarToSolar(dateIso: string): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const lunar = Lunar.fromYmd(y, m, d);
  const solar = lunar.getSolar();
  const mm = String(solar.getMonth()).padStart(2, "0");
  const dd = String(solar.getDay()).padStart(2, "0");
  return `${solar.getYear()}-${mm}-${dd}`;
}

function effectiveInput(
  input: HumanDesignInput,
  options: GenerateChartOptions,
): HumanDesignInput {
  return {
    ...input,
    date:
      options.calendarType === "lunar"
        ? convertLunarToSolar(input.date)
        : input.date,
  };
}

export async function generateHumanDesignChart(
  input: HumanDesignInput,
  options: GenerateChartOptions = {},
): Promise<HumanDesignChartData> {
  const integration = await getIntegration("humandesign");
  if (!integration || !integration.enabled || !integration.apiKey) {
    throw new HumanDesignApiError(
      "not_configured",
      "humandesign integration not configured",
    );
  }

  const effective = effectiveInput(input, options);
  const cacheKey = computeCacheKey(effective);

  // Cache hit? Skip API call entirely.
  const cached = await getCachedChart(cacheKey);
  if (cached) return cached;

  let raw: unknown;
  try {
    raw = await fetchBodygraph(
      { apiUrl: integration.apiUrl, apiKey: integration.apiKey },
      effective,
    );
  } catch (e) {
    if (e instanceof HumanDesignApiError) throw e;
    throw new HumanDesignApiError("unavailable", "fetch failed", e);
  }

  let chart: HumanDesignChartData;
  try {
    chart = normalizeResponse(raw);
  } catch (e) {
    console.error(
      "[humandesign] normalize failed:",
      e,
      "raw=",
      JSON.stringify(raw).slice(0, 1000),
    );
    throw new HumanDesignApiError("invalid_response", "response shape mismatch", e);
  }

  // Write-through cache (don't await — user-facing latency unaffected by cache write).
  void setCachedChart(cacheKey, chart).catch((err) =>
    console.error("[humandesign] cache write failed:", err),
  );

  return chart;
}

export interface GenerateTransitOptions {
  /** ISO 8601 datetime with timezone offset, e.g. "2026-04-25T15:30+08:00".
   *  If omitted, uses the current moment in Asia/Taipei (project default). */
  datetime?: string;
  /** City passed to humandesignhub (used for tz/lat resolution server-side). Defaults to "Taipei". */
  city?: string;
}

function defaultNowDatetime(): string {
  // Format current moment as ISO 8601 with +08:00 (Asia/Taipei) — project default.
  const d = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}+08:00`;
}

export async function generateTransit(
  options: GenerateTransitOptions = {},
): Promise<HumanDesignTransitData> {
  const integration = await getIntegration("humandesign");
  if (!integration || !integration.enabled || !integration.apiKey) {
    throw new HumanDesignApiError(
      "not_configured",
      "humandesign integration not configured",
    );
  }

  const datetime = options.datetime ?? defaultNowDatetime();
  const city = options.city ?? "Taipei";

  // Round to the hour for cache hits within the same hour.
  // Tolerates "YYYY-MM-DDTHH:mm[:ss][±HH:MM|Z]" — only the minute portion is replaced.
  const roundedHourly = datetime.replace(/T(\d{2}):\d{2}/, "T$1:00");
  const cacheKey = computeTransitCacheKey(roundedHourly, city);

  // chart_data column is polymorphic — caller's namespace (transit|) ensures no collision.
  const cached = await getCachedChart(cacheKey);
  if (cached) {
    return cached as unknown as HumanDesignTransitData;
  }

  const { fetchTransit } = await import("./client");
  const { normalizeTransitResponse } = await import("./normalize");
  let raw: unknown;
  try {
    raw = await fetchTransit(
      { apiUrl: integration.apiUrl, apiKey: integration.apiKey },
      { datetime, city },
    );
  } catch (e) {
    if (e instanceof HumanDesignApiError) throw e;
    throw new HumanDesignApiError("unavailable", "transit fetch failed", e);
  }

  let transit: HumanDesignTransitData;
  try {
    transit = normalizeTransitResponse(raw, datetime);
  } catch (e) {
    console.error(
      "[humandesign] transit normalize failed:",
      e,
      "raw=",
      JSON.stringify(raw).slice(0, 800),
    );
    throw new HumanDesignApiError(
      "invalid_response",
      "transit response shape mismatch",
      e,
    );
  }

  void setCachedChart(
    cacheKey,
    transit as unknown as HumanDesignChartData,
  ).catch((err) =>
    console.error("[humandesign] transit cache write failed:", err),
  );
  return transit;
}

export async function generateHumanDesignImage(
  input: HumanDesignInput,
  options: GenerateChartOptions = {},
): Promise<ArrayBuffer> {
  const integration = await getIntegration("humandesign");
  if (!integration || !integration.enabled || !integration.apiKey) {
    throw new HumanDesignApiError(
      "not_configured",
      "humandesign integration not configured",
    );
  }

  const effective = effectiveInput(input, options);
  const cacheKey = computeCacheKey(effective);

  const cached = await getCachedImage(cacheKey);
  if (cached) {
    return cached.buffer.slice(
      cached.byteOffset,
      cached.byteOffset + cached.byteLength,
    ) as ArrayBuffer;
  }

  let bytes: ArrayBuffer;
  try {
    bytes = await fetchBodygraphImage(
      { apiUrl: integration.apiUrl, apiKey: integration.apiKey },
      effective,
    );
  } catch (e) {
    if (e instanceof HumanDesignApiError) throw e;
    throw new HumanDesignApiError("unavailable", "image fetch failed", e);
  }

  void setCachedImage(cacheKey, bytes).catch((err) =>
    console.error("[humandesign] image cache write failed:", err),
  );

  return bytes;
}
