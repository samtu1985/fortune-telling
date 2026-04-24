import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import HumanDesignChart from "@/app/components/HumanDesignChart";
import { normalizeResponse } from "@/app/lib/humandesign/normalize";
import fixture from "@/app/lib/humandesign/__fixtures__/projector-sample.json";

describe("HumanDesignChart", () => {
  it("renders all 9 center shapes", () => {
    const chart = normalizeResponse(fixture);
    const { container } = render(<HumanDesignChart chart={chart} />);
    const centers = container.querySelectorAll("[data-center]");
    expect(centers.length).toBe(9);
  });

  it("marks defined centers with data-defined='true'", () => {
    const chart = normalizeResponse(fixture);
    const { container } = render(<HumanDesignChart chart={chart} />);
    const defined = container.querySelectorAll("[data-center][data-defined='true']");
    // Fixture has 6 defined centers (Ajna, G, Head, Root, Solar Plexus, Throat)
    expect(defined.length).toBe(6);
  });

  it("marks undefined centers with data-defined='false'", () => {
    const chart = normalizeResponse(fixture);
    const { container } = render(<HumanDesignChart chart={chart} />);
    const undef = container.querySelectorAll("[data-center][data-defined='false']");
    // Fixture has 3 undefined centers (Heart, Sacral, Spleen)
    expect(undef.length).toBe(3);
  });

  it("renders active channels with data-channel-active='true'", () => {
    const chart = normalizeResponse(fixture);
    const { container } = render(<HumanDesignChart chart={chart} />);
    const active = container.querySelectorAll("[data-channel-active='true']");
    // Fixture has 4 active channels
    expect(active.length).toBe(4);
  });

  it("renders inactive channels from CANONICAL_CHANNELS baseline", () => {
    const chart = normalizeResponse(fixture);
    const { container } = render(<HumanDesignChart chart={chart} />);
    const inactive = container.querySelectorAll("[data-channel-active='false']");
    // 36 canonical - 4 active = 32 inactive (assuming no active channel is absent from CANONICAL_CHANNELS)
    expect(inactive.length).toBeGreaterThanOrEqual(30);
  });

  it("uses the viewBox from layout constants", () => {
    const chart = normalizeResponse(fixture);
    const { container } = render(<HumanDesignChart chart={chart} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 800 1200");
  });
});
