import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { email: "admin@test" } })) }));
vi.mock("@/app/lib/users", () => ({ ADMIN_EMAIL: "admin@test" }));

const getIntegrationMock = vi.fn();
vi.mock("@/app/lib/integration-settings", () => ({
  getIntegration: (s: string) => getIntegrationMock(s),
}));

const fetchBodygraphMock = vi.fn();
vi.mock("@/app/lib/humandesign/client", async () => {
  const actual = await vi.importActual<typeof import("@/app/lib/humandesign/client")>(
    "@/app/lib/humandesign/client",
  );
  return { ...actual, fetchBodygraph: (...args: unknown[]) => fetchBodygraphMock(...args) };
});

import { POST } from "@/app/api/admin/integrations/test/route";

describe("/api/admin/integrations/test", () => {
  beforeEach(() => {
    getIntegrationMock.mockReset();
    fetchBodygraphMock.mockReset();
  });

  it("returns ok:true when probe succeeds", async () => {
    getIntegrationMock.mockResolvedValue({ service: "humandesign", apiUrl: "u", apiKey: "sk", enabled: true, metadata: null });
    fetchBodygraphMock.mockResolvedValue({});
    const req = new Request("http://x/api/admin/integrations/test", {
      method: "POST",
      body: JSON.stringify({ service: "humandesign" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns ok:false code=not_configured when no integration row exists", async () => {
    getIntegrationMock.mockResolvedValue(null);
    const req = new Request("http://x/api/admin/integrations/test", {
      method: "POST",
      body: JSON.stringify({ service: "humandesign" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("not_configured");
  });

  it("returns ok:false code=not_configured when key is empty", async () => {
    getIntegrationMock.mockResolvedValue({ service: "humandesign", apiUrl: "u", apiKey: "", enabled: true, metadata: null });
    const req = new Request("http://x/api/admin/integrations/test", {
      method: "POST",
      body: JSON.stringify({ service: "humandesign" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("not_configured");
  });

  it("returns ok:false with error code when probe throws HumanDesignApiError", async () => {
    const { HumanDesignApiError } = await import("@/app/lib/humandesign/client");
    getIntegrationMock.mockResolvedValue({ service: "humandesign", apiUrl: "u", apiKey: "sk", enabled: true, metadata: null });
    fetchBodygraphMock.mockRejectedValue(new HumanDesignApiError("auth", "bad key"));
    const req = new Request("http://x/api/admin/integrations/test", {
      method: "POST",
      body: JSON.stringify({ service: "humandesign" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("auth");
  });

  it("returns ok:false code=unavailable on unknown error", async () => {
    getIntegrationMock.mockResolvedValue({ service: "humandesign", apiUrl: "u", apiKey: "sk", enabled: true, metadata: null });
    fetchBodygraphMock.mockRejectedValue(new Error("totally unexpected"));
    const req = new Request("http://x/api/admin/integrations/test", {
      method: "POST",
      body: JSON.stringify({ service: "humandesign" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("unavailable");
  });

  it("rejects unknown service names", async () => {
    const req = new Request("http://x/api/admin/integrations/test", {
      method: "POST",
      body: JSON.stringify({ service: "something-else" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects non-admin callers with 403", async () => {
    const authMod = await import("@/app/lib/auth");
    (authMod.auth as any).mockResolvedValueOnce({ user: { email: "user@not-admin" } });
    const req = new Request("http://x/api/admin/integrations/test", {
      method: "POST",
      body: JSON.stringify({ service: "humandesign" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});
