import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { email: "admin@test" } })),
}));
vi.mock("@/app/lib/users", () => ({ ADMIN_EMAIL: "admin@test" }));

const listMock = vi.fn();
const upsertMock = vi.fn();
const deleteMock = vi.fn();
vi.mock("@/app/lib/integration-settings", () => ({
  listIntegrations: () => listMock(),
  upsertIntegration: (v: unknown) => upsertMock(v),
  deleteIntegration: (s: string) => deleteMock(s),
}));

import { GET, PUT, DELETE } from "@/app/api/admin/integrations/route";

describe("/api/admin/integrations", () => {
  beforeEach(() => {
    listMock.mockReset();
    upsertMock.mockReset();
    deleteMock.mockReset();
  });

  it("GET returns masked integrations", async () => {
    listMock.mockResolvedValue([
      { service: "humandesign", apiUrl: "u", apiKey: "sk_test_abcd1234", enabled: true, metadata: null },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].apiKey).toBe("••••1234");
    expect(body[0].hasKey).toBe(true);
    expect(body[0].enabled).toBe(true);
  });

  it("GET returns empty masked field when no key stored", async () => {
    listMock.mockResolvedValue([
      { service: "humandesign", apiUrl: "u", apiKey: "", enabled: false, metadata: null },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(body[0].apiKey).toBe("");
    expect(body[0].hasKey).toBe(false);
  });

  it("PUT upserts with the provided payload", async () => {
    upsertMock.mockResolvedValue(undefined);
    const req = new Request("http://x/api/admin/integrations", {
      method: "PUT",
      body: JSON.stringify({ service: "humandesign", apiUrl: "u", apiKey: "sk_new", enabled: true }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ service: "humandesign", apiKey: "sk_new", enabled: true, apiUrl: "u" }),
    );
  });

  it("PUT rejects unknown service names", async () => {
    const req = new Request("http://x/api/admin/integrations", {
      method: "PUT",
      body: JSON.stringify({ service: "something-else", apiUrl: "u", apiKey: "k" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("PUT rejects missing apiUrl", async () => {
    const req = new Request("http://x/api/admin/integrations", {
      method: "PUT",
      body: JSON.stringify({ service: "humandesign", apiKey: "k" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("DELETE removes by service query param", async () => {
    deleteMock.mockResolvedValue(undefined);
    const req = new Request("http://x/api/admin/integrations?service=humandesign", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith("humandesign");
  });

  it("DELETE rejects unknown service", async () => {
    const req = new Request("http://x/api/admin/integrations?service=zzz", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("non-admin caller is rejected 403 on GET/PUT/DELETE", async () => {
    const authMod = await import("@/app/lib/auth");
    (authMod.auth as any).mockResolvedValueOnce({ user: { email: "user@not-admin" } });
    const resGet = await GET();
    expect(resGet.status).toBe(403);

    (authMod.auth as any).mockResolvedValueOnce({ user: { email: "user@not-admin" } });
    const req = new Request("http://x/api/admin/integrations", {
      method: "PUT",
      body: JSON.stringify({ service: "humandesign", apiUrl: "u", apiKey: "k" }),
      headers: { "Content-Type": "application/json" },
    });
    const resPut = await PUT(req);
    expect(resPut.status).toBe(403);
  });
});
