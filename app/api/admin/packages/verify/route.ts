import { requireAdmin } from "@/app/lib/admin-guard";
import { requireStripe } from "@/app/lib/stripe";

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const { priceId } = body as { priceId?: string };
  if (
    !priceId ||
    typeof priceId !== "string" ||
    !priceId.startsWith("price_")
  ) {
    return Response.json({ error: "invalid_price_id" }, { status: 400 });
  }

  const stripe = requireStripe();

  try {
    const price = await stripe.prices.retrieve(priceId, {
      expand: ["product"],
    });
    const product = typeof price.product === "string" ? null : price.product;
    return Response.json({
      stripePriceId: price.id,
      priceAmount: price.unit_amount ?? 0,
      currency: price.currency,
      productName:
        product && "name" in product ? (product as { name: string }).name : null,
      active: price.active,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    return Response.json(
      { error: "stripe_lookup_failed", message: msg },
      { status: 404 }
    );
  }
}
