import { describe, it, expect } from "vitest";
import { serializeForPrompt } from "@/app/lib/humandesign/serialize";
import { normalizeResponse } from "@/app/lib/humandesign/normalize";
import fixture from "@/app/lib/humandesign/__fixtures__/projector-sample.json";

describe("serializeForPrompt", () => {
  const chart = normalizeResponse(fixture);

  it("wraps output with <humandesign-chart> tags", () => {
    const out = serializeForPrompt(chart);
    expect(out.startsWith("<humandesign-chart>")).toBe(true);
    expect(out.endsWith("</humandesign-chart>")).toBe(true);
  });

  it("omits raw and meta fields", () => {
    const out = serializeForPrompt(chart);
    expect(out.includes("\"raw\"")).toBe(false);
    expect(out.includes("\"meta\"")).toBe(false);
    expect(out.includes("\"fetchedAt\"")).toBe(false);
  });

  it("includes summary, centers, channels, planets", () => {
    const out = serializeForPrompt(chart);
    expect(out.includes("\"summary\"")).toBe(true);
    expect(out.includes("\"centers\"")).toBe(true);
    expect(out.includes("\"channels\"")).toBe(true);
    expect(out.includes("\"planets\"")).toBe(true);
    // spot-check content appears
    expect(out.includes("Projector")).toBe(true);
    expect(out.includes("Bitterness")).toBe(true);
  });

  it("keeps payload under 6000 chars for a typical chart (~1.5k tokens)", () => {
    const out = serializeForPrompt(chart);
    expect(out.length).toBeLessThan(6000);
  });
});
