import { auth } from "@/app/lib/auth";
import {
  getSavedConversations,
  createSavedConversation,
} from "@/app/lib/users";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get("type") || undefined;
  const conversations = await getSavedConversations(email, type as "bazi" | "ziwei" | "zodiac" | undefined);
  return Response.json({ conversations });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const conv = await createSavedConversation(email, {
    type: body.type,
    userQuestion: body.userQuestion,
    aiResponse: body.aiResponse,
    aiReasoning: body.aiReasoning,
    profileLabel: body.profileLabel,
  });

  if (!conv) {
    return Response.json({ error: "使用者不存在" }, { status: 404 });
  }

  return Response.json({ conversation: conv }, { status: 201 });
}
