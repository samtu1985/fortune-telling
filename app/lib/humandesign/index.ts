import { Lunar } from "lunar-typescript";
import { getIntegration } from "@/app/lib/integration-settings";
import { fetchBodygraph, HumanDesignApiError } from "./client";
import { normalizeResponse } from "./normalize";
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

  const effectiveInput: HumanDesignInput = {
    ...input,
    date:
      options.calendarType === "lunar"
        ? convertLunarToSolar(input.date)
        : input.date,
  };

  let raw: unknown;
  try {
    raw = await fetchBodygraph(
      { apiUrl: integration.apiUrl, apiKey: integration.apiKey },
      effectiveInput,
    );
  } catch (e) {
    if (e instanceof HumanDesignApiError) throw e;
    throw new HumanDesignApiError("unavailable", "fetch failed", e);
  }

  try {
    return normalizeResponse(raw);
  } catch (e) {
    console.error(
      "[humandesign] normalize failed:",
      e,
      "raw=",
      JSON.stringify(raw).slice(0, 1000),
    );
    throw new HumanDesignApiError("invalid_response", "response shape mismatch", e);
  }
}
