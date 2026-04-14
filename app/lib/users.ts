import bcrypt from "bcryptjs";
import { eq, and, sql } from "drizzle-orm";
import { db } from "./db";
import { users, profiles, conversations, pendingCredits } from "./db/schema";
import { encrypt, decrypt } from "./db/encryption";
import { sendAdminNotification } from "./email";
import type { UserForQuota } from "./quota";

// ─── PII Encryption Helpers ─────────────────────────────

function encryptField(value: string): string {
  return value ? encrypt(value) : "";
}

function decryptField(value: string): string {
  if (!value) return "";
  // If value doesn't look encrypted (no colons = iv:tag:ciphertext), return as-is (legacy plaintext)
  if (!value.includes(":")) return value;
  try {
    return decrypt(value);
  } catch {
    // Decryption failed — likely plaintext from before encryption was enabled
    return value;
  }
}

function encryptCharts(charts: Record<string, string> | null | undefined): unknown {
  if (!charts) return null;
  return encrypt(JSON.stringify(charts));
}

function decryptCharts(stored: unknown): { bazi?: string; ziwei?: string; zodiac?: string } | undefined {
  if (!stored) return undefined;
  if (typeof stored === "object") return stored as { bazi?: string; ziwei?: string; zodiac?: string }; // legacy plaintext jsonb
  if (typeof stored === "string" && stored.includes(":")) {
    try {
      return JSON.parse(decrypt(stored));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export type UserStatus = "unverified" | "pending" | "approved" | "disabled";

export interface UserProfile {
  birthDate: string;
  birthTime: string;
  gender: string;
  birthPlace: string;
}

export interface SavedProfile {
  id: string;
  label: string;
  birthDate: string;
  birthTime: string;
  gender: string;
  birthPlace: string;
  calendarType: "solar" | "lunar";
  isLeapMonth: boolean;
  savedCharts?: {
    bazi?: string;
    ziwei?: string;
    zodiac?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SavedConversation {
  id: string;
  type: "bazi" | "ziwei" | "zodiac";
  userQuestion: string;
  aiResponse: string;
  aiReasoning?: string;
  profileLabel?: string;
  savedAt: string;
}

export type ReasoningDepth = "high" | "medium" | "low" | "off";

export interface UserData {
  name: string | null;
  image: string | null;
  status: UserStatus;
  createdAt: string;
  approvedAt: string | null;
  profiles?: SavedProfile[];
  savedConversations?: SavedConversation[];
  reasoningDepth?: ReasoningDepth;
  authProvider?: string;
  ageVerifiedAt: Date | null;
}

export type UsersStore = Record<string, UserData>;

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "geektu@gmail.com";

// ─── Internal helpers ────────────────────────────────────

async function getUserId(email: string): Promise<number | null> {
  const row = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return row[0]?.id ?? null;
}

// ─── Public API (same signatures as before) ──────────────

export async function readUsers(): Promise<UsersStore> {
  const rows = await db.select().from(users);
  const store: UsersStore = {};
  for (const row of rows) {
    store[row.email] = {
      name: row.name,
      image: row.image,
      status: row.status as UserStatus,
      createdAt: row.createdAt.toISOString(),
      approvedAt: row.approvedAt?.toISOString() ?? null,
      authProvider: row.authProvider,
      ageVerifiedAt: row.ageVerifiedAt ?? null,
    };
  }
  return store;
}

export async function getUser(email: string): Promise<UserData | null> {
  const row = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!row[0]) return null;
  const u = row[0];
  return {
    name: u.name,
    image: u.image,
    status: u.status as UserStatus,
    createdAt: u.createdAt.toISOString(),
    approvedAt: u.approvedAt?.toISOString() ?? null,
    ageVerifiedAt: u.ageVerifiedAt ?? null,
  };
}

/**
 * Fetch a user with all fields required by the quota system.
 * Returns null if not found. Used by /api/divine and /api/divine-multi.
 */
export async function getUserWithQuota(email: string): Promise<UserForQuota | null> {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      isAmbassador: users.isAmbassador,
      isFriend: users.isFriend,
      singleCredits: users.singleCredits,
      multiCredits: users.multiCredits,
      singleUsed: users.singleUsed,
      multiUsed: users.multiUsed,
      canPurchase: users.canPurchase,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row ?? null;
}

// Starter quota granted to every new regular user on first approval.
// Exempt roles (admin / ambassador / friend) bypass quota via isExempt()
// so this value is harmless for them.
export const STARTER_SINGLE_CREDITS = 10;
export const STARTER_MULTI_CREDITS = 2;

/**
 * Apply any pendingCredits rows (ambassador pre-gifts) to a user who just
 * became approved. Idempotent — deletes the pending rows after applying.
 */
async function applyPendingCreditsFor(email: string): Promise<void> {
  try {
    const pending = await db
      .select()
      .from(pendingCredits)
      .where(eq(pendingCredits.email, email));
    if (pending.length === 0) return;

    let totalSingle = 0;
    let totalMulti = 0;
    for (const p of pending) {
      totalSingle += p.singleCredits;
      totalMulti += p.multiCredits;
    }

    if (totalSingle > 0 || totalMulti > 0) {
      await db
        .update(users)
        .set({
          singleCredits: sql`${users.singleCredits} + ${totalSingle}`,
          multiCredits: sql`${users.multiCredits} + ${totalMulti}`,
        })
        .where(eq(users.email, email));
    }

    await db.delete(pendingCredits).where(eq(pendingCredits.email, email));
    console.log(
      `[users] Applied pending credits for ${email}: single=${totalSingle}, multi=${totalMulti}`
    );
  } catch (e) {
    console.error("[users] Failed to apply pending credits:", e);
  }
}

export async function registerUser(
  email: string,
  name: string | null,
  image: string | null
): Promise<void> {
  const isAdmin = email === ADMIN_EMAIL;
  const now = new Date();

  // Check whether this is a genuinely new user or a returning sign-in.
  // Returning sign-ins should NOT re-fire the admin notification nor
  // reset starter credits — they should just refresh name/image.
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    // Returning user — just sync profile fields from the OAuth provider.
    await db
      .update(users)
      .set({ name, image })
      .where(eq(users.email, email));
    return;
  }

  // As of 2026-04: paid quota system is live. New users (Google OAuth) are
  // auto-approved on first sign-in — no admin review — and get the starter
  // 10/2 quota. Admin still bypasses quota via isExempt().
  await db.insert(users).values({
    email,
    name,
    image,
    status: "approved",
    createdAt: now,
    approvedAt: now,
    singleCredits: STARTER_SINGLE_CREDITS,
    multiCredits: STARTER_MULTI_CREDITS,
  });

  if (!isAdmin) {
    // Apply any pending ambassador gifts on top of the starter quota.
    await applyPendingCreditsFor(email);

    // Fire-and-forget admin notification. This covers the Google OAuth path
    // — the credentials flow still fires its own notification from
    // /api/auth/verify-email since that's where "verification complete"
    // semantically happens for that flow.
    sendAdminNotification(email, name).catch((e) =>
      console.error("[users] admin notification failed:", e)
    );
  }
}

export async function updateUserStatus(
  email: string,
  status: UserStatus
): Promise<boolean> {
  const set: Record<string, unknown> = { status };
  if (status === "approved") {
    set.approvedAt = new Date();
  }
  const result = await db.update(users).set(set).where(eq(users.email, email));

  // When approving, apply any pending credits (admin override path).
  if (status === "approved") {
    await applyPendingCreditsFor(email);
  }

  return (result.rowCount ?? 0) > 0;
}

export async function deleteUser(email: string): Promise<boolean> {
  const result = await db.delete(users).where(eq(users.email, email));
  return (result.rowCount ?? 0) > 0;
}

// ─── Reasoning Depth (now stored in ai-settings, keep stub for compatibility) ──

export async function getReasoningDepth(_email: string): Promise<ReasoningDepth> {
  return "high";
}

export async function setReasoningDepth(
  _email: string,
  _depth: ReasoningDepth
): Promise<boolean> {
  return true;
}

// ─── Credentials Auth ───────────────────────────────────

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const row = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return row.length === 0;
}

export async function checkEmailAvailable(email: string): Promise<boolean> {
  const row = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row.length === 0;
}

export async function registerCredentialsUser(params: {
  username: string;
  email: string;
  password: string;
  name?: string;
  verifyToken: string;
}): Promise<void> {
  const passwordHash = await bcrypt.hash(params.password, 10);
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await db.insert(users).values({
    email: params.email,
    name: params.name || params.username,
    username: params.username,
    passwordHash,
    authProvider: "credentials",
    status: "unverified",
    resetToken: params.verifyToken,
    resetTokenExpiry: expiry,
    createdAt: new Date(),
  });
}

export async function verifyEmail(token: string): Promise<{ email: string; name: string | null } | null> {
  const row = await db
    .select()
    .from(users)
    .where(and(eq(users.resetToken, token), eq(users.status, "unverified")))
    .limit(1);

  if (!row[0]) return null;
  if (!row[0].resetTokenExpiry || row[0].resetTokenExpiry < new Date()) return null;

  // Auto-approve on email verification + grant starter quota.
  // (Previously this set status to "pending" and waited for admin review;
  // with the paid quota system live, that friction is no longer needed.)
  const now = new Date();
  await db
    .update(users)
    .set({
      status: "approved",
      approvedAt: now,
      resetToken: null,
      resetTokenExpiry: null,
      singleCredits: STARTER_SINGLE_CREDITS,
      multiCredits: STARTER_MULTI_CREDITS,
    })
    .where(eq(users.id, row[0].id));

  // Apply any pending ambassador gifts on top of the starter quota.
  await applyPendingCreditsFor(row[0].email);

  return { email: row[0].email, name: row[0].name };
}

export async function verifyCredentials(
  username: string,
  password: string
): Promise<{ id: number; email: string; name: string | null; image: string | null; status: string } | null> {
  const row = await db
    .select()
    .from(users)
    .where(and(eq(users.username, username), eq(users.authProvider, "credentials")))
    .limit(1);
  if (!row[0]) return null;

  const valid = await bcrypt.compare(password, row[0].passwordHash || "");
  if (!valid) return null;

  return {
    id: row[0].id,
    email: row[0].email,
    name: row[0].name,
    image: row[0].image,
    status: row[0].status,
  };
}

export async function setResetToken(email: string, token: string): Promise<boolean> {
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  const result = await db
    .update(users)
    .set({ resetToken: token, resetTokenExpiry: expiry })
    .where(and(eq(users.email, email), eq(users.authProvider, "credentials")));
  return (result.rowCount ?? 0) > 0;
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const row = await db
    .select()
    .from(users)
    .where(eq(users.resetToken, token))
    .limit(1);

  if (!row[0]) return false;
  if (!row[0].resetTokenExpiry || row[0].resetTokenExpiry < new Date()) return false;

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db
    .update(users)
    .set({ passwordHash, resetToken: null, resetTokenExpiry: null })
    .where(eq(users.id, row[0].id));

  return true;
}

// ─── Profiles ────────────────────────────────────────────

const MAX_PROFILES = 10;

export async function getProfiles(email: string): Promise<SavedProfile[]> {
  const userId = await getUserId(email);
  if (!userId) return [];
  const rows = await db.select().from(profiles).where(eq(profiles.userId, userId));
  return rows.map(mapProfile);
}

export async function createProfile(
  email: string,
  profile: Omit<SavedProfile, "id" | "createdAt" | "updatedAt">
): Promise<SavedProfile | null> {
  const userId = await getUserId(email);
  if (!userId) return null;

  // Check max
  const existing = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, userId));
  if (existing.length >= MAX_PROFILES) return null;

  const now = new Date();
  const result = await db
    .insert(profiles)
    .values({
      userId,
      label: profile.label,
      birthDate: encryptField(profile.birthDate),
      birthTime: encryptField(profile.birthTime),
      gender: encryptField(profile.gender),
      birthPlace: encryptField(profile.birthPlace),
      calendarType: profile.calendarType,
      isLeapMonth: profile.isLeapMonth,
      savedCharts: (encryptCharts(profile.savedCharts) as string) ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return result[0] ? mapProfile(result[0]) : null;
}

export async function updateProfileById(
  email: string,
  id: string,
  updates: Partial<Omit<SavedProfile, "id" | "createdAt">>
): Promise<boolean> {
  const userId = await getUserId(email);
  if (!userId) return false;

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.label !== undefined) set.label = updates.label;
  if (updates.birthDate !== undefined) set.birthDate = encryptField(updates.birthDate);
  if (updates.birthTime !== undefined) set.birthTime = encryptField(updates.birthTime);
  if (updates.gender !== undefined) set.gender = encryptField(updates.gender);
  if (updates.birthPlace !== undefined) set.birthPlace = encryptField(updates.birthPlace);
  if (updates.calendarType !== undefined) set.calendarType = updates.calendarType;
  if (updates.isLeapMonth !== undefined) set.isLeapMonth = updates.isLeapMonth;
  if (updates.savedCharts !== undefined) set.savedCharts = encryptCharts(updates.savedCharts);

  const result = await db
    .update(profiles)
    .set(set)
    .where(and(eq(profiles.id, id), eq(profiles.userId, userId)));

  return (result.rowCount ?? 0) > 0;
}

export async function deleteProfileById(
  email: string,
  id: string
): Promise<boolean> {
  const userId = await getUserId(email);
  if (!userId) return false;
  const result = await db.delete(profiles).where(and(eq(profiles.id, id), eq(profiles.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}

function mapProfile(row: typeof profiles.$inferSelect): SavedProfile {
  return {
    id: row.id,
    label: row.label,
    birthDate: decryptField(row.birthDate),
    birthTime: decryptField(row.birthTime),
    gender: decryptField(row.gender),
    birthPlace: decryptField(row.birthPlace),
    calendarType: row.calendarType as "solar" | "lunar",
    isLeapMonth: row.isLeapMonth,
    savedCharts: decryptCharts(row.savedCharts),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── Saved Conversations ─────────────────────────────────

export async function getSavedConversations(
  email: string,
  type?: "bazi" | "ziwei" | "zodiac"
): Promise<SavedConversation[]> {
  const userId = await getUserId(email);
  if (!userId) return [];

  const where = type
    ? and(eq(conversations.userId, userId), eq(conversations.type, type))
    : eq(conversations.userId, userId);

  const rows = await db.select().from(conversations).where(where);
  return rows.map(mapConversation);
}

export async function createSavedConversation(
  email: string,
  conv: Omit<SavedConversation, "id" | "savedAt">
): Promise<SavedConversation | null> {
  const userId = await getUserId(email);
  if (!userId) return null;

  const result = await db
    .insert(conversations)
    .values({
      userId,
      type: conv.type,
      userQuestion: encryptField(conv.userQuestion),
      aiResponse: encryptField(conv.aiResponse),
      aiReasoning: conv.aiReasoning ? encryptField(conv.aiReasoning) : null,
      profileLabel: conv.profileLabel ?? null,
      savedAt: new Date(),
    })
    .returning();

  return result[0] ? mapConversation(result[0]) : null;
}

export async function deleteSavedConversation(
  email: string,
  id: string
): Promise<boolean> {
  const userId = await getUserId(email);
  if (!userId) return false;
  const result = await db.delete(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}

function mapConversation(row: typeof conversations.$inferSelect): SavedConversation {
  return {
    id: row.id,
    type: row.type as "bazi" | "ziwei" | "zodiac",
    userQuestion: decryptField(row.userQuestion),
    aiResponse: decryptField(row.aiResponse),
    aiReasoning: row.aiReasoning ? decryptField(row.aiReasoning) : undefined,
    profileLabel: row.profileLabel ?? undefined,
    savedAt: row.savedAt.toISOString(),
  };
}
