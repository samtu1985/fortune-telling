import { NextRequest } from "next/server";
import { auth } from "@/app/lib/auth";
import { db } from "@/app/lib/db";
import { feedback } from "@/app/lib/db/schema";
import { sendFeedbackAdminNotification } from "@/app/lib/email";

const MAX_MESSAGE_LENGTH = 4000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawName = typeof body.name === "string" ? body.name.trim() : "";
    const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
    const rawMessage = typeof body.message === "string" ? body.message.trim() : "";

    if (!rawName || !rawEmail || !rawMessage) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (rawMessage.length > MAX_MESSAGE_LENGTH) {
      return Response.json({ error: "Message too long" }, { status: 400 });
    }
    // Basic email sanity check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return Response.json({ error: "Invalid email" }, { status: 400 });
    }

    const session = await auth();
    const userEmail = session?.user?.email ?? null;

    const inserted = await db
      .insert(feedback)
      .values({
        name: rawName.slice(0, 255),
        email: rawEmail.slice(0, 255),
        userEmail: userEmail ? userEmail.slice(0, 255) : null,
        message: rawMessage,
      })
      .returning({ id: feedback.id });

    const id = inserted[0]?.id ?? 0;

    // Fire-and-forget admin notification
    sendFeedbackAdminNotification(rawName, rawEmail, rawMessage, id).catch((e) =>
      console.error("[feedback] Admin notification failed:", e)
    );

    return Response.json({ success: true, id });
  } catch (e) {
    console.error("[feedback] POST failed:", e);
    return Response.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
