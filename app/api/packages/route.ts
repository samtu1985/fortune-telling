import { auth } from "@/app/lib/auth";
import { db } from "@/app/lib/db";
import { paymentPackages } from "@/app/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: paymentPackages.id,
      name: paymentPackages.name,
      description: paymentPackages.description,
      buyButtonId: paymentPackages.buyButtonId,
      publishableKey: paymentPackages.publishableKey,
      priceAmount: paymentPackages.priceAmount,
      currency: paymentPackages.currency,
      singleCreditsGranted: paymentPackages.singleCreditsGranted,
      multiCreditsGranted: paymentPackages.multiCreditsGranted,
    })
    .from(paymentPackages)
    .where(eq(paymentPackages.isActive, true))
    .orderBy(asc(paymentPackages.sortOrder));

  return Response.json({ packages: rows });
}
