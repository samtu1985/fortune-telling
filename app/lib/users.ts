import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { users, profiles, conversations } from "./db/schema";

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
  };
}

export async function registerUser(
  email: string,
  name: string | null,
  image: string | null
): Promise<void> {
  const isAdmin = email === ADMIN_EMAIL;
  const now = new Date();

  await db
    .insert(users)
    .values({
      email,
      name,
      image,
      status: isAdmin ? "approved" : "pending",
      createdAt: now,
      approvedAt: isAdmin ? now : null,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { name, image },
    });

  // Auto-approve admin if not already
  if (isAdmin) {
    await db
      .update(users)
      .set({ status: "approved", approvedAt: now })
      .where(and(eq(users.email, email), eq(users.status, "pending")));
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

  await db
    .update(users)
    .set({ status: "pending", resetToken: null, resetTokenExpiry: null })
    .where(eq(users.id, row[0].id));

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
      birthDate: profile.birthDate,
      birthTime: profile.birthTime,
      gender: profile.gender,
      birthPlace: profile.birthPlace,
      calendarType: profile.calendarType,
      isLeapMonth: profile.isLeapMonth,
      savedCharts: profile.savedCharts ?? null,
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
  if (updates.birthDate !== undefined) set.birthDate = updates.birthDate;
  if (updates.birthTime !== undefined) set.birthTime = updates.birthTime;
  if (updates.gender !== undefined) set.gender = updates.gender;
  if (updates.birthPlace !== undefined) set.birthPlace = updates.birthPlace;
  if (updates.calendarType !== undefined) set.calendarType = updates.calendarType;
  if (updates.isLeapMonth !== undefined) set.isLeapMonth = updates.isLeapMonth;
  if (updates.savedCharts !== undefined) set.savedCharts = updates.savedCharts;

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
    birthDate: row.birthDate,
    birthTime: row.birthTime,
    gender: row.gender,
    birthPlace: row.birthPlace,
    calendarType: row.calendarType as "solar" | "lunar",
    isLeapMonth: row.isLeapMonth,
    savedCharts: row.savedCharts ?? undefined,
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
      userQuestion: conv.userQuestion,
      aiResponse: conv.aiResponse,
      aiReasoning: conv.aiReasoning ?? null,
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
    userQuestion: row.userQuestion,
    aiResponse: row.aiResponse,
    aiReasoning: row.aiReasoning ?? undefined,
    profileLabel: row.profileLabel ?? undefined,
    savedAt: row.savedAt.toISOString(),
  };
}
