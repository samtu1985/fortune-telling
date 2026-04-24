import { auth } from "@/app/lib/auth";
import { ADMIN_EMAIL } from "@/app/lib/users";
import {
  listIntegrations,
  upsertIntegration,
  deleteIntegration,
} from "@/app/lib/integration-settings";

const VALID_SERVICES = new Set(["humandesign"]);

async function requireAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.email === ADMIN_EMAIL;
}

function mask(apiKey: string): string {
  return apiKey ? "••••" + apiKey.slice(-4) : "";
}

export async function GET() {
  if (!(await requireAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }
  const rows = await listIntegrations();
  return Response.json(
    rows.map((r) => ({
      service: r.service,
      apiUrl: r.apiUrl,
      apiKey: mask(r.apiKey),
      hasKey: !!r.apiKey,
      enabled: r.enabled,
      metadata: r.metadata ?? null,
    })),
  );
}

export async function PUT(req: Request) {
  if (!(await requireAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const service = String(body?.service ?? "");
  if (!VALID_SERVICES.has(service)) {
    return Response.json({ error: `Invalid service: ${service}` }, { status: 400 });
  }
  const apiUrl = typeof body.apiUrl === "string" ? body.apiUrl : "";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey : "";
  const enabled = !!body.enabled;
  if (!apiUrl) {
    return Response.json({ error: "apiUrl required" }, { status: 400 });
  }
  await upsertIntegration({ service, apiUrl, apiKey, enabled });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }
  const service = new URL(req.url).searchParams.get("service") ?? "";
  if (!VALID_SERVICES.has(service)) {
    return Response.json({ error: "Invalid service" }, { status: 400 });
  }
  await deleteIntegration(service);
  return Response.json({ ok: true });
}
