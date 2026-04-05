import { auth } from "@/app/lib/auth";
import { ADMIN_EMAIL } from "@/app/lib/users";
import { db } from "@/app/lib/db";
import { creditSettings } from "@/app/lib/db/schema";
import { eq } from "drizzle-orm";

async function checkAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.email === ADMIN_EMAIL;
}

export async function GET() {
  if (!(await checkAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const rows = await db.select().from(creditSettings).limit(1);
  if (rows[0]) {
    return Response.json(rows[0]);
  }
  // Return defaults if no row exists
  return Response.json({ defaultSingleRounds: 10, defaultMultiSessions: 1 });
}

export async function PUT(request: Request) {
  if (!(await checkAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { defaultSingleRounds, defaultMultiSessions } = (await request.json()) as {
    defaultSingleRounds: number;
    defaultMultiSessions: number;
  };

  const existing = await db.select().from(creditSettings).limit(1);
  if (existing[0]) {
    await db
      .update(creditSettings)
      .set({ defaultSingleRounds, defaultMultiSessions, updatedAt: new Date() })
      .where(eq(creditSettings.id, existing[0].id));
  } else {
    await db.insert(creditSettings).values({
      defaultSingleRounds,
      defaultMultiSessions,
    });
  }

  return Response.json({ success: true });
}
