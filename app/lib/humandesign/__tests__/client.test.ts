import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchBodygraph, HumanDesignApiError } from "@/app/lib/humandesign/client";

describe("humandesign client", () => {
  const originalFetch = global.fetch;
  beforeEach(() => { global.fetch = originalFetch; });

  it("sends X-API-KEY and datetime/city body to /v1/bodygraph", async () => {
    const captured: any = {};
    global.fetch = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      captured.url = url;
      captured.init = init;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    await fetchBodygraph({
      apiUrl: "https://api.humandesignhub.app/v1",
      apiKey: "sk_test",
    }, { date: "1990-05-15", time: "14:30", city: "Taipei" });
    expect(captured.url).toBe("https://api.humandesignhub.app/v1/bodygraph");
    expect(captured.init.headers["X-API-KEY"]).toBe("sk_test");
    const body = JSON.parse(captured.init.body);
    expect(body.city).toBe("Taipei");
    expect(body.datetime).toMatch(/^1990-05-15T14:30[+-]\d\d:\d\d$/);
  });

  it("uses provided timezone offset when supplied", async () => {
    let captured: any;
    global.fetch = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      captured = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    await fetchBodygraph(
      { apiUrl: "u", apiKey: "k" },
      { date: "2000-01-01", time: "12:00", city: "x", timezone: "Asia/Taipei" },
    );
    expect(captured.datetime).toBe("2000-01-01T12:00+08:00");
  });

  it("throws HumanDesignApiError(auth) on 401", async () => {
    global.fetch = vi.fn(async () => new Response("nope", { status: 401 }));
    await expect(
      fetchBodygraph(
        { apiUrl: "u", apiKey: "k" },
        { date: "2000-01-01", time: "00:00", city: "x" },
      ),
    ).rejects.toMatchObject({ code: "auth" });
  });

  it("throws HumanDesignApiError(unavailable) on timeout", async () => {
    global.fetch = vi.fn(async () => { throw new Error("timeout"); });
    await expect(
      fetchBodygraph(
        { apiUrl: "u", apiKey: "k" },
        { date: "2000-01-01", time: "00:00", city: "x" },
      ),
    ).rejects.toMatchObject({ code: "unavailable" });
  });
});
