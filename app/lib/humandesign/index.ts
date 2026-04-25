import { Lunar } from "lunar-typescript";
import { getIntegration } from "@/app/lib/integration-settings";
import { fetchBodygraph, fetchBodygraphImage, HumanDesignApiError } from "./client";
import { normalizeResponse } from "./normalize";
import {
  computeCacheKey,
  getCachedChart,
  getCachedImage,
  setCachedChart,
  setCachedImage,
} from "./cache";
import type { HumanDesignChartData, HumanDesignInput } from "./types";

export { HumanDesignApiError } from "./client";
export type { HumanDesignChartData, HumanDesignInput } from "./types";

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
