import { NextRequest } from "next/server";
import { auth } from "@/app/lib/auth";
import {
  readUsers,
  updateUserStatus,
  deleteUser,
  ADMIN_EMAIL,
  type UserStatus,
} from "@/app/lib/users";

async function checkAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.email === ADMIN_EMAIL;
}

export async function GET() {
  if (!(await checkAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const storageType = process.env.POSTGRES_URL
    ? "postgres"
    : "local";

  try {
    const users = await readUsers();

    const statusOrder: Record<UserStatus, number> = {
      unverified: 0,
      pending: 1,
      approved: 2,
      disabled: 3,
    };

    const list = Object.entries(users)
      .map(([email, data]) => ({ email, ...data }))
      .sort((a, b) => {
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];
        if (statusDiff !== 0) return statusDiff;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });

    return Response.json({ users: list, storageType });
  } catch (e) {
    console.error("[admin] Failed to read users:", e);
    return Response.json(
      {
        users: [],
        storageType,
        error: `儲存空間讀取失敗 (${storageType})`,
      },
      { status: 200 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await checkAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { email, status } = (await request.json()) as {
    email: string;
    status: UserStatus;
  };

  if (!email || !["pending", "approved", "disabled"].includes(status)) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  if (email === ADMIN_EMAIL) {
    return Response.json({ error: "Cannot modify admin" }, { status: 400 });
  }

  try {
    const ok = await updateUserStatus(email, status);
    if (!ok) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    return Response.json({ success: true });
  } catch (e) {
    console.error("[admin] PATCH failed:", e instanceof Error ? e.message : e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await checkAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { email } = (await request.json()) as { email: string };

  if (email === ADMIN_EMAIL) {
    return Response.json({ error: "Cannot delete admin" }, { status: 400 });
  }

  const ok = await deleteUser(email);
  if (!ok) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
