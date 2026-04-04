import { auth } from "@/app/lib/auth";
import { ADMIN_EMAIL } from "@/app/lib/users";
import { db } from "@/app/lib/db";
import { caseStudies } from "@/app/lib/db/schema";
import { desc } from "drizzle-orm";

async function checkAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.email === ADMIN_EMAIL;
}

export async function GET() {
  if (!(await checkAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const rows = await db
    .select({
      id: caseStudies.id,
      summary: caseStudies.summary,
      masterTypes: caseStudies.masterTypes,
      createdAt: caseStudies.createdAt,
    })
    .from(caseStudies)
    .orderBy(desc(caseStudies.createdAt));

  return Response.json({ cases: rows });
}
