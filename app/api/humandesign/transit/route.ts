import { NextRequest } from "next/server";
import { auth } from "@/app/lib/auth";
import { generateTransit, HumanDesignApiError } from "@/app/lib/humandesign";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { datetime?: unknown; city?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body ok — server picks defaults */
  }
  const datetime = typeof body.datetime === "string" ? body.datetime : undefined;
  const city = typeof body.city === "string" ? body.city : undefined;

  try {
    const transit = await generateTransit({ datetime, city });
    return Response.json({ transit });
  } catch (e) {
    if (e instanceof HumanDesignApiError) {
      const map: Record<string, number> = {
        not_configured: 422,
        auth: 502,
        invalid_input: 400,
        unavailable: 503,
        invalid_response: 500,
      };
      return Response.json(
        { error: `humandesign_${e.code}`, message: e.message },
        { status: map[e.code] ?? 500 },
      );
    }
    console.error("[humandesign/transit] unexpected:", e);
    return Response.json({ error: "humandesign_unknown" }, { status: 500 });
  }
}
