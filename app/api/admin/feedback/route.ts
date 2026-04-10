import { NextRequest } from "next/server";
import { auth } from "@/app/lib/auth";
import { ADMIN_EMAIL } from "@/app/lib/users";
import { db } from "@/app/lib/db";
import { feedback } from "@/app/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { sendFeedbackReply } from "@/app/lib/email";

async function checkAdmin(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.email === ADMIN_EMAIL) return session.user.email;
  return null;
}

// GET: list all feedback (newest first) + unread count
export async function GET() {
  if (!(await checkAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const rows = await db.select().from(feedback).orderBy(desc(feedback.createdAt));
    const unreadCount = rows.filter((r) => !r.isRead).length;
    return Response.json({
      feedback: rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        userEmail: r.userEmail,
        message: r.message,
        reply: r.reply,
        repliedAt: r.repliedAt?.toISOString() ?? null,
        repliedBy: r.repliedBy,
        isRead: r.isRead,
        createdAt: r.createdAt.toISOString(),
      })),
      unreadCount,
    });
  } catch (e) {
    console.error("[admin/feedback] GET failed:", e);
    return Response.json({ error: "Failed to load feedback" }, { status: 500 });
  }
}

// PATCH: reply to a feedback entry OR mark as read
export async function PATCH(request: NextRequest) {
  const adminEmail = await checkAdmin();
  if (!adminEmail) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await request.json()) as {
    id: number;
    reply?: string;
    markRead?: boolean;
  };

  if (!body.id || typeof body.id !== "number") {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    // Mark-as-read only path
    if (body.markRead && !body.reply) {
      await db.update(feedback).set({ isRead: true }).where(eq(feedback.id, body.id));
      return Response.json({ success: true });
    }

    const replyText = (body.reply || "").trim();
    if (!replyText) {
      return Response.json({ error: "Reply is empty" }, { status: 400 });
    }

    // Load original entry
    const existing = await db.select().from(feedback).where(eq(feedback.id, body.id)).limit(1);
    if (!existing[0]) {
      return Response.json({ error: "Feedback not found" }, { status: 404 });
    }
    const entry = existing[0];

    await db
      .update(feedback)
      .set({
        reply: replyText,
        repliedAt: new Date(),
        repliedBy: adminEmail,
        isRead: true,
      })
      .where(eq(feedback.id, body.id));

    // Fire-and-forget reply email to user
    sendFeedbackReply(entry.email, entry.name, entry.message, replyText).catch((e) =>
      console.error("[admin/feedback] Reply email failed:", e)
    );

    return Response.json({ success: true });
  } catch (e) {
    console.error("[admin/feedback] PATCH failed:", e);
    return Response.json({ error: "Failed to update feedback" }, { status: 500 });
  }
}

// GET unread count only (lightweight, polled by admin page)
export async function HEAD() {
  if (!(await checkAdmin())) {
    return new Response(null, { status: 403 });
  }
  try {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(feedback)
      .where(eq(feedback.isRead, false));
    const count = result[0]?.count ?? 0;
    return new Response(null, {
      status: 200,
      headers: { "x-unread-count": String(count) },
    });
  } catch {
    return new Response(null, { status: 500 });
  }
}
