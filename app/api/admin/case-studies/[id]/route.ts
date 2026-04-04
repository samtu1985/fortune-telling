import { NextRequest } from "next/server";
import { auth } from "@/app/lib/auth";
import { ADMIN_EMAIL } from "@/app/lib/users";
import { db } from "@/app/lib/db";
import { caseStudies } from "@/app/lib/db/schema";
import { eq } from "drizzle-orm";

async function checkAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.email === ADMIN_EMAIL;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const row = await db
    .select()
    .from(caseStudies)
    .where(eq(caseStudies.id, id))
    .limit(1);

  if (!row[0]) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(row[0]);
}
