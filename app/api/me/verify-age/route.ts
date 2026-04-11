import { NextRequest } from "next/server";
import { auth } from "@/app/lib/auth";
import { db } from "@/app/lib/db";
import { users } from "@/app/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const birthDate: string | undefined = body?.birthDate;
    if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      return Response.json({ error: "invalid_birth_date" }, { status: 400 });
    }

    const birth = new Date(birthDate + "T00:00:00Z");
    const now = new Date();
    if (isNaN(birth.getTime()) || birth > now || birth.getUTCFullYear() < 1900) {
      return Response.json({ error: "invalid_birth_date" }, { status: 400 });
    }

    // Age computation: full years difference, accounting for month/day
    let age = now.getUTCFullYear() - birth.getUTCFullYear();
    const m = now.getUTCMonth() - birth.getUTCMonth();
    if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) age--;

    const canPurchase = age >= 18;

    await db
      .update(users)
      .set({
        birthDate,
        ageVerifiedAt: new Date(),
        canPurchase,
      })
      .where(eq(users.email, session.user.email));

    return Response.json({ canPurchase, age });
  } catch (e) {
    console.error("[api/me/verify-age] POST failed:", e);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
