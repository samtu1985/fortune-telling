import { requireAdmin } from "@/app/lib/admin-guard";
import { db } from "@/app/lib/db";
import { paymentPackages } from "@/app/lib/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const rows = await db
    .select()
    .from(paymentPackages)
    .orderBy(asc(paymentPackages.sortOrder));
  return Response.json({ packages: rows });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const body = await req.json();

  const required = [
    "name",
    "buyButtonId",
    "stripePriceId",
    "priceAmount",
    "currency",
  ];
  for (const k of required) {
    if (body[k] == null) {
      return Response.json({ error: `missing ${k}` }, { status: 400 });
    }
  }

  const [inserted] = await db
    .insert(paymentPackages)
    .values({
      name: body.name,
      description: body.description ?? null,
      buyButtonId: body.buyButtonId,
      stripePriceId: body.stripePriceId,
      priceAmount: body.priceAmount,
      currency: body.currency,
      singleCreditsGranted: body.singleCreditsGranted ?? 0,
      multiCreditsGranted: body.multiCreditsGranted ?? 0,
      sortOrder: body.sortOrder ?? 0,
      isActive: body.isActive ?? true,
    })
    .returning();

  return Response.json({ package: inserted });
}
