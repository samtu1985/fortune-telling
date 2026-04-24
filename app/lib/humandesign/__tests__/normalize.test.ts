import { describe, it, expect } from "vitest";
import { normalizeResponse } from "@/app/lib/humandesign/normalize";
import fixture from "@/app/lib/humandesign/__fixtures__/projector-sample.json";

describe("normalizeResponse", () => {
  it("produces HumanDesignChartData with required shape", () => {
    const r = normalizeResponse(fixture);
    expect(r.meta.service).toBe("humandesign");
    expect(r.summary.type).toBe("Projector");
    expect(r.summary.profile).toBe("6/2");
    expect(r.summary.strategy).toBe("Wait for the Invitation");
    expect(r.summary.authority).toBe("Emotional");
    expect(r.summary.definition).toBe("Split Definition");
    expect(r.summary.signature).toBe("Success");
    expect(r.summary.notSelfTheme).toBe("Bitterness");
  });

  it("marks exactly the defined centers from array names", () => {
    const r = normalizeResponse(fixture);
    expect(r.centers.ajna.defined).toBe(true);
    expect(r.centers.g.defined).toBe(true);
    expect(r.centers.head.defined).toBe(true);
    expect(r.centers.root.defined).toBe(true);
    expect(r.centers.solarPlexus.defined).toBe(true);
    expect(r.centers.throat.defined).toBe(true);
    expect(r.centers.heart.defined).toBe(false);
    expect(r.centers.sacral.defined).toBe(false);
    expect(r.centers.spleen.defined).toBe(false);
  });

  it("distributes activatedGates to their center", () => {
    const r = normalizeResponse(fixture);
    // From fixture.gates: [1, 7, 13, 15, 19, 21, 22, 23, 24, 29, 30, 33, 38, 41, 43, 50, 52, 58, 61]
    expect(r.centers.g.activatedGates).toEqual(expect.arrayContaining([1, 7, 13, 15]));
    expect(r.centers.head.activatedGates).toContain(61);
    expect(r.centers.throat.activatedGates).toContain(23);
    expect(r.centers.throat.activatedGates).toContain(33);
    expect(r.centers.ajna.activatedGates).toContain(24);
    expect(r.centers.ajna.activatedGates).toContain(43);
    expect(r.centers.root.activatedGates).toContain(19);
    expect(r.centers.root.activatedGates).toContain(38);
    expect(r.centers.root.activatedGates).toContain(41);
    expect(r.centers.root.activatedGates).toContain(52);
    expect(r.centers.root.activatedGates).toContain(58);
    expect(r.centers.solarPlexus.activatedGates).toContain(22);
    expect(r.centers.solarPlexus.activatedGates).toContain(30);
  });

  it("marks all returned channels active (API omits inactive)", () => {
    const r = normalizeResponse(fixture);
    expect(r.channels.length).toBe(4);
    expect(r.channels.every((c) => c.active === true)).toBe(true);
    const labels = r.channels.map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(["Prodigal", "Structuring", "Awareness", "Recognition"]));
  });

  it("loads all 14 planets per side (incl. Chiron) with rich activation data", () => {
    const r = normalizeResponse(fixture);
    expect(Object.keys(r.planets.personality).length).toBe(14);
    expect(Object.keys(r.planets.design).length).toBe(14);
    expect(r.planets.personality.sun).toEqual({ gate: 23, line: 6, color: 4, tone: 6, base: 3 });
    expect(r.planets.personality.chiron).toEqual({ gate: 39, line: 4, color: 6, tone: 4, base: 5 });
    expect(r.planets.design.sun).toEqual({ gate: 30, line: 2, color: 5, tone: 5, base: 2 });
  });

  it("produces gates array with both sources", () => {
    const r = normalizeResponse(fixture);
    expect(r.gates.length).toBeGreaterThan(0);
    const sources = new Set(r.gates.map((g) => g.source));
    expect(sources.has("personality")).toBe(true);
    expect(sources.has("design")).toBe(true);
    const first = r.gates[0];
    expect(typeof first.number).toBe("number");
    expect(typeof first.line).toBe("number");
    expect(typeof first.planet).toBe("string");
  });

  it("preserves raw for debugging", () => {
    const r = normalizeResponse(fixture);
    expect(r.raw).toBeDefined();
  });

  it("throws on missing required fields", () => {
    expect(() => normalizeResponse({})).toThrowError(/invalid/i);
    expect(() => normalizeResponse({ type: "Projector" })).toThrowError(/invalid/i);
    expect(() => normalizeResponse(null)).toThrowError(/invalid/i);
  });
});
