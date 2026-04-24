import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { email: "user@test" } })) }));

const generateMock = vi.fn();
vi.mock("@/app/lib/humandesign", () => {
  class HumanDesignApiError extends Error {
    code: string;
    cause?: unknown;
    constructor(code: string, message: string, cause?: unknown) {
      super(message);
      this.code = code;
      this.cause = cause;
    }
  }
  return {
    HumanDesignApiError,
    generateHumanDesignChart: (...args: any[]) => generateMock(...args),
  };
});

// Also stub the other chart generators so the route file compiles + imports succeed
vi.mock("@/app/lib/bazi", () => ({ generateBaziChart: vi.fn() }));
vi.mock("@/app/lib/ziwei", () => ({ generateZiweiChart: vi.fn() }));
vi.mock("@/app/lib/astrology", () => ({ generateNatalChart: vi.fn() }));

import { POST } from "@/app/api/chart/route";

function req(body: unknown) {
  return new Request("http://x/api/chart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("/api/chart humandesign branch", () => {
  beforeEach(() => { generateMock.mockReset(); });

  it("returns structured chart on success", async () => {
    generateMock.mockResolvedValue({
      meta: { fetchedAt: "2026-01-01T00:00:00Z", service: "humandesign" },
      summary: { type: "Generator", strategy: "s", authority: "a", profile: "1/3", definition: "Single", signature: "", notSelfTheme: "" },
      centers: {}, channels: [], gates: [], planets: { personality: {}, design: {} },
    });
    const res = await POST(req({
      type: "humandesign",
      birthDate: "1990-05-15", birthTime: "14:30", birthPlace: "Taipei",
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chart.summary.type).toBe("Generator");
  });

  it("returns 422 humandesign_not_configured when integration disabled", async () => {
    const { HumanDesignApiError } = await import("@/app/lib/humandesign");
    generateMock.mockRejectedValue(new HumanDesignApiError("not_configured", "disabled"));
    const res = await POST(req({
      type: "humandesign",
      birthDate: "1990-05-15", birthTime: "14:30", birthPlace: "Taipei",
    }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("humandesign_not_configured");
  });

  it("returns 502 humandesign_auth on auth error", async () => {
    const { HumanDesignApiError } = await import("@/app/lib/humandesign");
    generateMock.mockRejectedValue(new HumanDesignApiError("auth", "bad key"));
    const res = await POST(req({
      type: "humandesign",
      birthDate: "1990-05-15", birthTime: "14:30", birthPlace: "Taipei",
    }));
    expect(res.status).toBe(502);
  });

  it("returns 503 humandesign_unavailable on network error", async () => {
    const { HumanDesignApiError } = await import("@/app/lib/humandesign");
    generateMock.mockRejectedValue(new HumanDesignApiError("unavailable", "timeout"));
    const res = await POST(req({
      type: "humandesign",
      birthDate: "1990-05-15", birthTime: "14:30", birthPlace: "Taipei",
    }));
    expect(res.status).toBe(503);
  });

  it("returns 400 when birthPlace is missing for humandesign", async () => {
    const res = await POST(req({
      type: "humandesign",
      birthDate: "1990-05-15", birthTime: "14:30",
    }));
    expect(res.status).toBe(400);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    const authMod = await import("@/app/lib/auth");
    (authMod.auth as any).mockResolvedValueOnce(null);
    const res = await POST(req({
      type: "humandesign",
      birthDate: "1990-05-15", birthTime: "14:30", birthPlace: "Taipei",
    }));
    expect(res.status).toBe(401);
  });
});
