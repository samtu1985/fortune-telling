import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/app/lib/db", () => ({ db: { /* stubbed in each test */ } }));
vi.mock("@/app/lib/db/encryption", () => ({
  encrypt: (v: string) => `enc:${v}`,
  decrypt: (v: string) => v.startsWith("enc:") ? v.slice(4) : "",
}));

import {
  getIntegration,
  upsertIntegration,
  listIntegrations,
} from "@/app/lib/integration-settings";

describe("integration-settings", () => {
  beforeEach(() => vi.resetModules());

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
});
