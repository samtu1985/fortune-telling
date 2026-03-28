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

  const users = await readUsers();

  // Convert to array sorted by: pending first, then by creation date
  const statusOrder: Record<UserStatus, number> = {
    pending: 0,
    approved: 1,
    disabled: 2,
  };

  const list = Object.entries(users)
    .map(([email, data]) => ({ email, ...data }))
    .sort((a, b) => {
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return Response.json({ users: list });
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

  const ok = await updateUserStatus(email, status);
  if (!ok) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json({ success: true });
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
