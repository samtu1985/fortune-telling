import { describe, it, expect, vi } from "vitest";

vi.mock("@/app/lib/db", () => ({ db: { /* stubbed in each test */ } }));

// Use reconfigurable vi.fn() implementations so individual tests can change
// behavior (e.g. make decrypt throw) without breaking the module-level mock.
const encryptFn = vi.fn((v: string) => `enc:${v}`);
const decryptFn = vi.fn((v: string) => (v.startsWith("enc:") ? v.slice(4) : ""));
vi.mock("@/app/lib/db/encryption", () => ({
  encrypt: (v: string) => encryptFn(v),
  decrypt: (v: string) => decryptFn(v),
}));

import {
  getIntegration,
  upsertIntegration,
  listIntegrations,
  deleteIntegration,
} from "@/app/lib/integration-settings";

describe("integration-settings", () => {
  it("upsertIntegration encrypts apiKey before write", async () => {
    const rows: any[] = [];
    const db = await import("@/app/lib/db");
    (db.db as any) = {
      insert: () => ({
        values: (v: any) => ({
          onConflictDoUpdate: async (_: any) => { rows.push(v); },
        }),
      }),
    };
    await upsertIntegration({ service: "humandesign", apiUrl: "u", apiKey: "sk_test", enabled: true });
    expect(rows[0].apiKeyEncrypted).toBe("enc:sk_test");
    expect(rows[0].apiKey).toBeUndefined();
  });

  it("getIntegration returns null when missing", async () => {
    const db = await import("@/app/lib/db");
    (db.db as any) = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    };
    const result = await getIntegration("humandesign");
    expect(result).toBeNull();
  });

  it("upsertIntegration stores empty string when apiKey is empty (no crypto call)", async () => {
    const rows: any[] = [];
    const db = await import("@/app/lib/db");
    (db.db as any) = {
      insert: () => ({
        values: (v: any) => ({
          onConflictDoUpdate: async (_: any) => { rows.push(v); },
        }),
      }),
    };
    await upsertIntegration({ service: "humandesign", apiUrl: "u", apiKey: "", enabled: true });
    expect(rows[0].apiKeyEncrypted).toBe("");
  });

  it("deleteIntegration issues a where-by-service DELETE", async () => {
    const captured: any = {};
    const db = await import("@/app/lib/db");
    (db.db as any) = {
      delete: (table: any) => ({
        where: async (cond: any) => { captured.table = table; captured.cond = cond; },
      }),
    };
    await deleteIntegration("humandesign");
    expect(captured.cond).toBeDefined();
  });

  it("listIntegrations decrypts every row", async () => {
    const db = await import("@/app/lib/db");
    (db.db as any) = {
      select: () => ({
        from: async () => [
          { service: "humandesign", apiUrl: "u1", apiKeyEncrypted: "enc:sk1", enabled: true, metadata: null },
          { service: "other",       apiUrl: "u2", apiKeyEncrypted: "enc:sk2", enabled: false, metadata: { v: 1 } },
        ],
      }),
    };
    const result = await listIntegrations();
    expect(result).toHaveLength(2);
    expect(result[0].apiKey).toBe("sk1");
    expect(result[1].apiKey).toBe("sk2");
    expect(result[1].metadata).toEqual({ v: 1 });
  });

  it("getIntegration returns apiKey='' and logs on decrypt failure", async () => {
    const db = await import("@/app/lib/db");
    (db.db as any) = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              { service: "humandesign", apiUrl: "u", apiKeyEncrypted: "garbage", enabled: true, metadata: null },
            ],
          }),
        }),
      }),
    };
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Reconfigure decrypt to throw just for this test
    decryptFn.mockImplementationOnce(() => { throw new Error("boom"); });
    const result = await getIntegration("humandesign");
    expect(result).not.toBeNull();
    expect(result!.apiKey).toBe("");
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
