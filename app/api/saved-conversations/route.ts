import { auth } from "@/app/lib/auth";
import {
  getSavedConversations,
  createSavedConversation,
  autoSaveConversation,
  type ConversationType,
  type ConversationOrigin,
} from "@/app/lib/users";
import { NextRequest } from "next/server";

const ALLOWED_TYPES: ConversationType[] = ["bazi", "ziwei", "zodiac", "multi"];
const ALLOWED_ORIGINS: ConversationOrigin[] = ["manual", "auto"];

export async function GET(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const typeParam = request.nextUrl.searchParams.get("type") ?? undefined;
  const originParam = request.nextUrl.searchParams.get("origin") ?? undefined;

  const type =
    typeParam && ALLOWED_TYPES.includes(typeParam as ConversationType)
      ? (typeParam as ConversationType)
      : undefined;
  const origin =
    originParam && ALLOWED_ORIGINS.includes(originParam as ConversationOrigin)
      ? (originParam as ConversationOrigin)
      : undefined;

  const conversations = await getSavedConversations(email, type, origin);
  return Response.json({ conversations });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (!ALLOWED_TYPES.includes(body.type)) {
    return Response.json({ error: "invalid type" }, { status: 400 });
  }

  const origin: ConversationOrigin = body.origin === "auto" ? "auto" : "manual";

  const payload = {
    type: body.type as ConversationType,
    userQuestion: body.userQuestion,
    aiResponse: body.aiResponse,
    aiReasoning: body.aiReasoning,
    profileLabel: body.profileLabel,
  };

  const conv =
    origin === "auto"
      ? await autoSaveConversation(email, payload)
      : await createSavedConversation(email, payload);

  if (!conv) {
    return Response.json({ error: "使用者不存在" }, { status: 404 });
  }

  return Response.json({ conversation: conv }, { status: 201 });
}
