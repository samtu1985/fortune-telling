import { auth } from "@/app/lib/auth";
import { ADMIN_EMAIL } from "@/app/lib/users";
import { db } from "@/app/lib/db";
import { users } from "@/app/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await db
    .select({
      id: users.id,
      singleCredits: users.singleCredits,
      multiCredits: users.multiCredits,
      singleUsed: users.singleUsed,
      multiUsed: users.multiUsed,
      isAmbassador: users.isAmbassador,
      isFriend: users.isFriend,
      canPurchase: users.canPurchase,
      ageVerifiedAt: users.ageVerifiedAt,
    })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!row[0]) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const u = row[0];
  const isAdmin = session.user.email === ADMIN_EMAIL;
  const unlimited = isAdmin || u.isAmbassador || u.isFriend;

  return Response.json({
    id: u.id,
    singleCredits: u.singleCredits,
    singleUsed: u.singleUsed,
    singleRemaining: unlimited ? -1 : u.singleCredits - u.singleUsed,
    multiCredits: u.multiCredits,
    multiUsed: u.multiUsed,
    multiRemaining: unlimited ? -1 : u.multiCredits - u.multiUsed,
    isAmbassador: u.isAmbassador,
    isFriend: u.isFriend,
    unlimited,
    canPurchase: u.canPurchase,
    ageVerified: u.ageVerifiedAt !== null,
  });
}
