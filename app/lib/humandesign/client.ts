import type { HumanDesignInput } from "./types";

export type HumanDesignErrorCode =
  | "not_configured" | "auth" | "invalid_input" | "unavailable" | "invalid_response";

export class HumanDesignApiError extends Error {
  code: HumanDesignErrorCode;
  cause?: unknown;
  constructor(code: HumanDesignErrorCode, message: string, cause?: unknown) {
    super(message);
    this.code = code;
    this.cause = cause;
  }
}

interface ClientConfig {
  apiUrl: string;     // e.g. "https://api.humandesignhub.app/v1"
  apiKey: string;
  timeoutMs?: number; // default 10_000
}

export async function fetchBodygraph(
  cfg: ClientConfig,
  input: HumanDesignInput,
): Promise<unknown> {
  if (!cfg.apiKey) throw new HumanDesignApiError("not_configured", "API key missing");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 10_000);
  try {
    const res = await fetch(`${cfg.apiUrl.replace(/\/$/, "")}/bodygraph`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": cfg.apiKey,
      },
      body: JSON.stringify({
        date: input.date,
        time: input.time,
        city: input.city,
        ...(input.timezone ? { timezone: input.timezone } : {}),
      }),
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403) {
      throw new HumanDesignApiError("auth", `humandesignhub ${res.status}`);
    }
    if (res.status === 400 || res.status === 422) {
      const body = await res.text().catch(() => "");
      throw new HumanDesignApiError("invalid_input", `humandesignhub ${res.status}: ${body.slice(0, 200)}`);
    }
    if (!res.ok) {
      throw new HumanDesignApiError("unavailable", `humandesignhub ${res.status}`);
    }
    return await res.json();
  } catch (e) {
    if (e instanceof HumanDesignApiError) throw e;
    throw new HumanDesignApiError("unavailable", "request failed", e);
  } finally {
    clearTimeout(timer);
  }
}
