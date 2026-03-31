import { auth } from "@/app/lib/auth";
import { updateProfileById, deleteProfileById } from "@/app/lib/users";
import { NextRequest } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const ok = await updateProfileById(email, id, body);
  if (!ok) {
    return Response.json({ error: "檔案不存在" }, { status: 404 });
  }
  return Response.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ok = await deleteProfileById(email, id);
  if (!ok) {
    return Response.json({ error: "檔案不存在" }, { status: 404 });
  }
  return Response.json({ success: true });
}
