import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchBodygraph, HumanDesignApiError } from "@/app/lib/humandesign/client";

describe("humandesign client", () => {
  const originalFetch = global.fetch;
  beforeEach(() => { global.fetch = originalFetch; });

  it("sends X-API-KEY and JSON body to /v1/bodygraph", async () => {
    const captured: any = {};
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
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
    expect(JSON.parse(captured.init.body)).toMatchObject({ date: "1990-05-15", time: "14:30", city: "Taipei" });
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
