import fs from "fs/promises";
import path from "path";

export type UserStatus = "pending" | "approved" | "disabled";

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

export interface UserData {
  name: string | null;
  image: string | null;
  status: UserStatus;
  createdAt: string;
  approvedAt: string | null;
  profile?: UserProfile;              // legacy, will be migrated
  profiles?: SavedProfile[];
  savedConversations?: SavedConversation[];
}

export type UsersStore = Record<string, UserData>;

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "geektu@gmail.com";

const BLOB_PATH = "users.json";
const LOCAL_FILE = path.join(process.cwd(), "data", "users.json");

function useBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export async function readUsers(): Promise<UsersStore> {
  if (useBlob()) {
    try {
      const { head } = await import("@vercel/blob");
      const meta = await head(BLOB_PATH);
      // Use downloadUrl (signed, time-limited) to avoid CDN cache returning stale data
      const res = await fetch(meta.downloadUrl, {
        cache: "no-store",
      });
      if (!res.ok) {
        console.error("[users] Blob fetch failed:", res.status, res.statusText);
        return {};
      }
      return await res.json();
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "BlobNotFoundError") {
        return {};
      }
      console.error("[users] Failed to read from Blob:", e instanceof Error ? e.message : e);
      return {};
    }
  }

  // Local file fallback for development
  try {
    const data = await fs.readFile(LOCAL_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    // File doesn't exist yet, return empty
    return {};
  }
}

export async function writeUsers(users: UsersStore): Promise<void> {
  if (useBlob()) {
    const { put } = await import("@vercel/blob");
    await put(BLOB_PATH, JSON.stringify(users, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return;
  }

  // Local file fallback
  const dir = path.dirname(LOCAL_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(LOCAL_FILE, JSON.stringify(users, null, 2), "utf-8");
}

function migrateUserData(user: UserData): UserData {
  // Migrate legacy single profile to profiles array
  if (user.profile && !user.profiles) {
    const legacy = user.profile;
    user.profiles = [
      {
        id: crypto.randomUUID(),
        label: "本人",
        birthDate: legacy.birthDate || "",
        birthTime: legacy.birthTime || "",
        gender: legacy.gender || "",
        birthPlace: legacy.birthPlace || "",
        calendarType: "solar",
        isLeapMonth: false,
        createdAt: user.createdAt,
        updatedAt: new Date().toISOString(),
      },
    ];
    delete user.profile;
  }
  return user;
}

export async function getUser(email: string): Promise<UserData | null> {
  const users = await readUsers();
  const user = users[email];
  if (!user) return null;
  const hadLegacyProfile = !!user.profile && !user.profiles;
  migrateUserData(user);
  if (hadLegacyProfile) {
    await writeUsers(users);
  }
  return user;
}

export async function registerUser(
  email: string,
  name: string | null,
  image: string | null
): Promise<void> {
  console.log("[users] registerUser called:", email, "useBlob:", useBlob());
  const users = await readUsers();
  const isAdmin = email === ADMIN_EMAIL;

  if (!users[email]) {
    users[email] = {
      name,
      image,
      status: isAdmin ? "approved" : "pending",
      createdAt: new Date().toISOString(),
      approvedAt: isAdmin ? new Date().toISOString() : null,
    };
  } else {
    users[email].name = name;
    users[email].image = image;
    if (isAdmin && users[email].status !== "approved") {
      users[email].status = "approved";
      users[email].approvedAt = new Date().toISOString();
    }
  }

  await writeUsers(users);
  console.log("[users] registerUser success:", email);
}

export async function updateUserStatus(
  email: string,
  status: UserStatus
): Promise<boolean> {
  const users = await readUsers();
  if (!users[email]) return false;
  users[email].status = status;
  if (status === "approved" && !users[email].approvedAt) {
    users[email].approvedAt = new Date().toISOString();
  }
  await writeUsers(users);
  return true;
}

export async function deleteUser(email: string): Promise<boolean> {
  const users = await readUsers();
  if (!users[email]) return false;
  delete users[email];
  await writeUsers(users);
  return true;
}

const MAX_PROFILES = 10;

export async function getProfiles(email: string): Promise<SavedProfile[]> {
  const users = await readUsers();
  const user = users[email];
  if (!user) return [];
  const hadLegacyProfile = !!user.profile && !user.profiles;
  migrateUserData(user);
  if (hadLegacyProfile) {
    await writeUsers(users);
  }
  return user.profiles || [];
}

export async function createProfile(
  email: string,
  profile: Omit<SavedProfile, "id" | "createdAt" | "updatedAt">
): Promise<SavedProfile | null> {
  const users = await readUsers();
  if (!users[email]) return null;
  migrateUserData(users[email]);
  const profiles = users[email].profiles || [];
  if (profiles.length >= MAX_PROFILES) return null;

  const now = new Date().toISOString();
  const newProfile: SavedProfile = {
    ...profile,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  profiles.push(newProfile);
  users[email].profiles = profiles;
  await writeUsers(users);
  return newProfile;
}

export async function updateProfileById(
  email: string,
  id: string,
  updates: Partial<Omit<SavedProfile, "id" | "createdAt">>
): Promise<boolean> {
  const users = await readUsers();
  if (!users[email]) return false;
  migrateUserData(users[email]);
  const profiles = users[email].profiles || [];
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  profiles[idx] = { ...profiles[idx], ...updates, updatedAt: new Date().toISOString() };
  users[email].profiles = profiles;
  await writeUsers(users);
  return true;
}

export async function deleteProfileById(
  email: string,
  id: string
): Promise<boolean> {
  const users = await readUsers();
  if (!users[email]) return false;
  migrateUserData(users[email]);
  const profiles = users[email].profiles || [];
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  profiles.splice(idx, 1);
  users[email].profiles = profiles;
  await writeUsers(users);
  return true;
}

export async function getSavedConversations(
  email: string,
  type?: "bazi" | "ziwei" | "zodiac"
): Promise<SavedConversation[]> {
  const users = await readUsers();
  const user = users[email];
  if (!user) return [];
  const all = user.savedConversations || [];
  if (type) return all.filter((c) => c.type === type);
  return all;
}

export async function createSavedConversation(
  email: string,
  conv: Omit<SavedConversation, "id" | "savedAt">
): Promise<SavedConversation | null> {
  const users = await readUsers();
  if (!users[email]) return null;
  const conversations = users[email].savedConversations || [];
  const newConv: SavedConversation = {
    ...conv,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  };
  conversations.push(newConv);
  users[email].savedConversations = conversations;
  await writeUsers(users);
  return newConv;
}

export async function deleteSavedConversation(
  email: string,
  id: string
): Promise<boolean> {
  const users = await readUsers();
  if (!users[email]) return false;
  const conversations = users[email].savedConversations || [];
  const idx = conversations.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  conversations.splice(idx, 1);
  users[email].savedConversations = conversations;
  await writeUsers(users);
  return true;
}
