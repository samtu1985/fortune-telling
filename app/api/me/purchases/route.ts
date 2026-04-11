import { auth } from "@/app/lib/auth";
import { db } from "@/app/lib/db";
import { purchases, paymentPackages, users } from "@/app/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { isExempt } from "@/app/lib/quota";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!user) return Response.json({ error: "not_found" }, { status: 404 });

  const rows = await db
    .select({
      id: purchases.id,
      createdAt: purchases.createdAt,
      packageName: paymentPackages.name,
      amount: purchases.amount,
      currency: purchases.currency,
      singleGranted: purchases.singleGranted,
      multiGranted: purchases.multiGranted,
      status: purchases.status,
    })
    .from(purchases)
    .leftJoin(paymentPackages, eq(purchases.packageId, paymentPackages.id))
    .where(eq(purchases.userId, user.id))
    .orderBy(desc(purchases.createdAt));

  return Response.json({
    purchases: rows,
    quota: {
      unlimited: isExempt(user),
      singleCredits: user.singleCredits,
      multiCredits: user.multiCredits,
      singleUsed: user.singleUsed,
      multiUsed: user.multiUsed,
      singleRemaining: user.singleCredits - user.singleUsed,
      multiRemaining: user.multiCredits - user.multiUsed,
    },
  });
}
