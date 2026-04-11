import { requireAdmin } from "@/app/lib/admin-guard";
import { stripeConfigStatus } from "@/app/lib/stripe";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  return Response.json(stripeConfigStatus());
}
