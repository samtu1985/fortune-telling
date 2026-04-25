import { describe, it, expect, vi } from "vitest";

vi.mock("@/app/lib/db", () => ({ db: {} }));

import {
  computeCacheKey,
  getCachedChart,
  setCachedChart,
  getCachedImage,
} from "@/app/lib/humandesign/cache";

describe("humandesign cache", () => {
  it("computeCacheKey is deterministic and stable", () => {
    const a = computeCacheKey({ date: "1990-05-15", time: "14:30", city: "Taipei" });
    const b = computeCacheKey({ date: "1990-05-15", time: "14:30", city: "Taipei" });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(a)).toBe(true);
  });

  it("computeCacheKey differentiates city case-insensitively", () => {
    const lower = computeCacheKey({ date: "1990-05-15", time: "14:30", city: "Taipei" });
    const upper = computeCacheKey({ date: "1990-05-15", time: "14:30", city: "TAIPEI" });
    expect(lower).toBe(upper);
  });

  it("computeCacheKey changes when birth data changes", () => {
    const base = computeCacheKey({ date: "1990-05-15", time: "14:30", city: "Taipei" });
    expect(base).not.toBe(computeCacheKey({ date: "1990-05-16", time: "14:30", city: "Taipei" }));
    expect(base).not.toBe(computeCacheKey({ date: "1990-05-15", time: "14:31", city: "Taipei" }));
    expect(base).not.toBe(computeCacheKey({ date: "1990-05-15", time: "14:30", city: "Tokyo" }));
  });

  it("getCachedChart returns null when row missing", async () => {
    const db = await import("@/app/lib/db");
    (db.db as any) = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    };
    expect(await getCachedChart("any")).toBeNull();
  });

  it("getCachedImage decodes base64 to Uint8Array", async () => {
    const db = await import("@/app/lib/db");
    const expectedBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const b64 = Buffer.from(expectedBytes).toString("base64");
    (db.db as any) = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ b64 }] }) }) }),
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    };
    const result = await getCachedImage("any");
    expect(result).toEqual(expectedBytes);
  });

  it("setCachedChart calls upsert with chart_data", async () => {
    const captured: any = {};
    const db = await import("@/app/lib/db");
    (db.db as any) = {
      insert: () => ({
        values: (v: any) => ({
          onConflictDoUpdate: async (args: any) => {
            captured.values = v;
            captured.set = args.set;
          },
        }),
      }),
    };
    await setCachedChart("k1", { summary: { type: "Generator" } } as any);
    expect(captured.values.cacheKey).toBe("k1");
    expect(captured.values.chartData).toBeDefined();
    expect(captured.set.chartData).toBeDefined();
  });
});
