import { NextRequest } from "next/server";
import { auth } from "@/app/lib/auth";
import { ADMIN_EMAIL } from "@/app/lib/users";
import { db } from "@/app/lib/db";
import { users, pendingCredits } from "@/app/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { sendTrialNotification, sendTrialInvitation } from "@/app/lib/email";

export async function POST(request: NextRequest) {
  const session = await auth();
  const senderEmail = session?.user?.email;
  if (!senderEmail) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if sender is admin or ambassador
  const sender = await db
    .select({ isAmbassador: users.isAmbassador })
    .from(users)
    .where(eq(users.email, senderEmail))
    .limit(1);

  const isAdmin = senderEmail === ADMIN_EMAIL;
  const isAmbassador = sender[0]?.isAmbassador === true;

  if (!isAdmin && !isAmbassador) {
    return Response.json({ error: "Not authorized to send credits" }, { status: 403 });
  }

  const { email, singleCredits: sc, multiCredits: mc } = (await request.json()) as {
    email: string;
    singleCredits: number;
    multiCredits: number;
  };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Invalid email" }, { status: 400 });
  }

  const singleCredits = Math.max(0, Math.floor(sc || 0));
  const multiCredits = Math.max(0, Math.floor(mc || 0));

  // Check if user exists
  const existingUser = await db
    .select({ email: users.email, status: users.status })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser[0]) {
    // User exists — add credits directly
    await db
      .update(users)
      .set({
        singleCredits: sql`${users.singleCredits} + ${singleCredits}`,
        multiCredits: sql`${users.multiCredits} + ${multiCredits}`,
      })
      .where(eq(users.email, email));

    // Send notification email
    await sendTrialNotification(email, singleCredits, multiCredits);

    return Response.json({ success: true, status: "credited" });
  } else {
    // User doesn't exist — store as pending credits
    await db.insert(pendingCredits).values({
      email,
      singleCredits,
      multiCredits,
      sentBy: senderEmail,
    });

    // Send invitation email
    await sendTrialInvitation(email, singleCredits, multiCredits);

    return Response.json({ success: true, status: "pending" });
  }
}
