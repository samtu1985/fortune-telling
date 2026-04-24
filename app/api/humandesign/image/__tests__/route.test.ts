import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { email: "u@t" } })) }));

const imageMock = vi.fn();
vi.mock("@/app/lib/humandesign", async () => {
  // Minimal HumanDesignApiError for instanceof checks inside the route
  class HumanDesignApiError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return {
    generateHumanDesignImage: (...args: any[]) => imageMock(...args),
    HumanDesignApiError,
  };
});

import { POST } from "@/app/api/humandesign/image/route";

function req(body: unknown) {
  return new Request("http://x/api/humandesign/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("/api/humandesign/image", () => {
  beforeEach(() => {
    imageMock.mockReset();
  });

  it("streams PNG on success with cache header", async () => {
    imageMock.mockResolvedValue(new Uint8Array([137, 80, 78, 71]).buffer);
    const res = await POST(req({
      birthDate: "1990-05-15",
      birthTime: "14:30",
      birthPlace: "Taipei",
    }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toMatch(/immutable/);
  });

  it("returns 400 when birthPlace missing", async () => {
    const res = await POST(req({ birthDate: "1990-05-15", birthTime: "14:30" }));
    expect(res.status).toBe(400);
    expect(imageMock).not.toHaveBeenCalled();
  });

  it("maps HumanDesignApiError('auth') to 502", async () => {
    const { HumanDesignApiError } = await import("@/app/lib/humandesign");
    imageMock.mockRejectedValue(new HumanDesignApiError("auth", "bad key"));
    const res = await POST(req({
      birthDate: "1990-05-15",
      birthTime: "14:30",
      birthPlace: "Taipei",
    }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("humandesign_auth");
  });

  it("rejects unauthenticated callers", async () => {
    const authMod = await import("@/app/lib/auth");
    (authMod.auth as any).mockResolvedValueOnce(null);
    const res = await POST(req({
      birthDate: "1990-05-15",
      birthTime: "14:30",
      birthPlace: "Taipei",
    }));
    expect(res.status).toBe(401);
  });
});
