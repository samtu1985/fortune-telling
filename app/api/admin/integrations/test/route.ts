import { auth } from "@/app/lib/auth";
import { ADMIN_EMAIL } from "@/app/lib/users";
import { getIntegration } from "@/app/lib/integration-settings";
import { fetchBodygraph, HumanDesignApiError } from "@/app/lib/humandesign/client";

async function requireAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.email === ADMIN_EMAIL;
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* empty body acceptable */
  }
  const service = String(body?.service ?? "humandesign");
  if (service !== "humandesign") {
    return Response.json({ error: "Unsupported service" }, { status: 400 });
  }

  const integration = await getIntegration("humandesign");
  if (!integration || !integration.apiKey) {
    return Response.json({ ok: false, code: "not_configured" }, { status: 200 });
  }

  try {
    await fetchBodygraph(
      { apiUrl: integration.apiUrl, apiKey: integration.apiKey, timeoutMs: 8000 },
      { date: "1990-05-15", time: "12:00", city: "Taipei" },
    );
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof HumanDesignApiError) {
      return Response.json({ ok: false, code: e.code, message: e.message }, { status: 200 });
    }
    return Response.json({ ok: false, code: "unavailable", message: "unknown" }, { status: 200 });
  }
}
