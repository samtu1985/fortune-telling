import { auth } from "@/app/lib/auth";
import { db } from "@/app/lib/db";
import { users } from "@/app/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type } = (await request.json()) as { type: "single" | "multi" };

  if (type === "single") {
    await db
      .update(users)
      .set({ singleUsed: sql`${users.singleUsed} + 1` })
      .where(eq(users.email, session.user.email));
  } else if (type === "multi") {
    await db
      .update(users)
      .set({ multiUsed: sql`${users.multiUsed} + 1` })
      .where(eq(users.email, session.user.email));
  } else {
    return Response.json({ error: "Invalid type" }, { status: 400 });
  }

  return Response.json({ success: true });
}
