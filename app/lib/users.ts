import fs from "fs/promises";
import path from "path";

export type UserStatus = "pending" | "approved" | "disabled";

export interface UserProfile {
  birthDate: string;
  birthTime: string;
  gender: string;
  birthPlace: string;
}

export interface UserData {
  name: string | null;
  image: string | null;
  status: UserStatus;
  createdAt: string;
  approvedAt: string | null;
  profile?: UserProfile;
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
      const token = process.env.BLOB_READ_WRITE_TOKEN!;
      const res = await fetch(meta.url, {
        headers: { Authorization: `Bearer ${token}` },
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

export async function getUser(email: string): Promise<UserData | null> {
  const users = await readUsers();
  return users[email] || null;
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

export async function getProfile(email: string): Promise<UserProfile | null> {
  const users = await readUsers();
  return users[email]?.profile ?? null;
}

export async function updateProfile(
  email: string,
  profile: UserProfile
): Promise<boolean> {
  const users = await readUsers();
  if (!users[email]) return false;
  users[email].profile = profile;
  await writeUsers(users);
  return true;
}
