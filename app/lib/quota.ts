import { db } from "@/app/lib/db";
import { sql } from "drizzle-orm";

export type QuotaType = "single" | "multi";

export type QuotaCheck =
  | { ok: true; unlimited: true }
  | { ok: true; unlimited: false; remaining: number }
  | { ok: false; reason: "exhausted"; canPurchase: boolean };

export interface UserForQuota {
  id: number;
  email: string;
  isAmbassador: boolean;
  isFriend: boolean;
  singleCredits: number;
  multiCredits: number;
  singleUsed: number;
  multiUsed: number;
  canPurchase: boolean;
}

// Kept in sync with app/lib/users.ts's ADMIN_EMAIL export. Inlined (not
// imported) to avoid a circular import — users.ts type-imports from this
// file. If process.env.ADMIN_EMAIL is unset on the deployment, the hardcoded
// fallback applies so admin is never silently dropped from the exempt list.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "geektu@gmail.com";

export function isExempt(
  user: Pick<UserForQuota, "email" | "isAmbassador" | "isFriend">
): boolean {
  if (user.email === ADMIN_EMAIL) return true;
  if (user.isAmbassador) return true;
  if (user.isFriend) return true;
  return false;
}

export function checkQuota(user: UserForQuota, type: QuotaType): QuotaCheck {
  if (type !== "single" && type !== "multi") {
    throw new Error(`invalid quota type: ${type}`);
  }
  if (isExempt(user)) return { ok: true, unlimited: true };
  const credits = type === "single" ? user.singleCredits : user.multiCredits;
  const used = type === "single" ? user.singleUsed : user.multiUsed;
  const remaining = credits - used;
  if (remaining <= 0) {
    return { ok: false, reason: "exhausted", canPurchase: user.canPurchase };
  }
  return { ok: true, unlimited: false, remaining };
}

/**
 * Atomically consume one unit of quota. Returns true if consumed,
 * false if the user ran out between check and consume (race).
 * Exempt users always succeed and still bump the used counter for analytics.
 */
export async function consumeQuota(
  user: UserForQuota,
  type: QuotaType
): Promise<boolean> {
  if (type !== "single" && type !== "multi") {
    throw new Error(`invalid quota type: ${type}`);
  }
  const exempt = isExempt(user);
  const usedCol = type === "single" ? "single_used" : "multi_used";
  const creditsCol = type === "single" ? "single_credits" : "multi_credits";

  // Conditional UPDATE: either the user is exempt, or used < credits.
  // Using raw SQL so the condition and increment happen atomically.
  // usedCol/creditsCol are hardcoded strings (not user input), so sql.raw is safe.
  const result = await db.execute(sql`
    UPDATE users
    SET ${sql.raw(`"${usedCol}"`)} = ${sql.raw(`"${usedCol}"`)} + 1
    WHERE id = ${user.id}
      AND (
        ${exempt ? sql`TRUE` : sql`${sql.raw(`"${usedCol}"`)} < ${sql.raw(`"${creditsCol}"`)}`}
      )
    RETURNING id
  `);

  // neon-http may return either an array or { rows: [...] }
  const rows: unknown[] = Array.isArray(result)
    ? result
    : Array.isArray((result as { rows?: unknown[] }).rows)
      ? (result as { rows: unknown[] }).rows
      : [];
  return rows.length > 0;
}
