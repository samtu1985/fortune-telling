import { requireAdmin } from "@/app/lib/admin-guard";
import {
  listTTSPronunciationRules,
  createTTSPronunciationRule,
} from "@/app/lib/tts-settings";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const rules = await listTTSPronunciationRules();
  return Response.json({ rules });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: {
    pattern?: unknown;
    replacement?: unknown;
    note?: unknown;
    isActive?: unknown;
    sortOrder?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const pattern = typeof body.pattern === "string" ? body.pattern.trim() : "";
  const replacement =
    typeof body.replacement === "string" ? body.replacement.trim() : "";
  if (!pattern || !replacement) {
    return Response.json(
      { error: "pattern and replacement are required" },
      { status: 400 },
    );
  }
  if (pattern.length > 200 || replacement.length > 200) {
    return Response.json(
      { error: "pattern/replacement too long (max 200 chars)" },
      { status: 400 },
    );
  }

  const note =
    typeof body.note === "string" && body.note.trim().length > 0
      ? body.note.trim()
      : null;
  const isActive = typeof body.isActive === "boolean" ? body.isActive : true;
  const sortOrder =
    typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
      ? Math.round(body.sortOrder)
      : 0;

  const rule = await createTTSPronunciationRule({
    pattern,
    replacement,
    note,
    isActive,
    sortOrder,
  });
  return Response.json({ rule });
}
