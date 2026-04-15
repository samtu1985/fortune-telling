import { requireAdmin } from "@/app/lib/admin-guard";
import { db } from "@/app/lib/db";
import { creditGrants } from "@/app/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const limit = Math.min(
    200,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "50")),
  );

  const rows = await db
    .select()
    .from(creditGrants)
    .orderBy(desc(creditGrants.createdAt))
    .limit(limit);

  return Response.json({
    grants: rows.map((r) => ({
      id: r.id,
      senderEmail: r.senderEmail,
      recipientEmail: r.recipientEmail,
      singleCredits: r.singleCredits,
      multiCredits: r.multiCredits,
      deliveryMode: r.deliveryMode,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
