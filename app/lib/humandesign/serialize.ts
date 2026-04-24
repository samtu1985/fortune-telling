import type { HumanDesignChartData } from "./types";

/**
 * Serialize a normalized Human Design chart into a <humandesign-chart>…</humandesign-chart>
 * block suitable for injection into an AI system prompt. Deliberately omits `raw`
 * and `meta` to keep token count predictable.
 *
 * The emitted JSON's center.activatedGates arrays are sorted numerically for
 * determinism across identical charts across different runs.
 */
export function serializeForPrompt(chart: HumanDesignChartData): string {
  const centers = Object.fromEntries(
    Object.entries(chart.centers).map(([k, v]) => [
      k,
      { defined: v.defined, activatedGates: [...v.activatedGates].sort((a, b) => a - b) },
    ]),
  );

  const payload = {
    summary: chart.summary,
    centers,
    channels: chart.channels,
    planets: chart.planets,
  };

  return `<humandesign-chart>${JSON.stringify(payload)}</humandesign-chart>`;
}
