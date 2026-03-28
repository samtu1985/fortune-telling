import { put, list } from "@vercel/blob";
import fs from "fs/promises";
import path from "path";

export type UserStatus = "pending" | "approved" | "disabled";

export interface UserData {
  name: string | null;
  image: string | null;
  status: UserStatus;
  createdAt: string;
  approvedAt: string | null;
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
      const { blobs } = await list({ prefix: BLOB_PATH, limit: 1 });
      if (blobs.length === 0) return {};
      const res = await fetch(blobs[0].downloadUrl, { cache: "no-store" });
      return await res.json();
    } catch {
      return {};
    }
  }

  // Local file fallback for development
  try {
    const data = await fs.readFile(LOCAL_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export async function writeUsers(users: UsersStore): Promise<void> {
  if (useBlob()) {
    await put(BLOB_PATH, JSON.stringify(users, null, 2), {
      access: "public",
      addRandomSuffix: false,
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
    // Update profile info on subsequent logins
    users[email].name = name;
    users[email].image = image;
    // Auto-approve admin if somehow not approved
    if (isAdmin && users[email].status !== "approved") {
      users[email].status = "approved";
      users[email].approvedAt = new Date().toISOString();
    }
  }

  await writeUsers(users);
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
