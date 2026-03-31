import { auth } from "@/app/lib/auth";
import { deleteSavedConversation } from "@/app/lib/users";
import { NextRequest } from "next/server";

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
  const ok = await deleteSavedConversation(email, id);
  if (!ok) {
    return Response.json({ error: "對話不存在" }, { status: 404 });
  }
  return Response.json({ success: true });
}
