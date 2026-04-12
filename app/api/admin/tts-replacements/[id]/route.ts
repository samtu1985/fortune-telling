import { requireAdmin } from "@/app/lib/admin-guard";
import {
  updateTTSPronunciationRule,
  deleteTTSPronunciationRule,
} from "@/app/lib/tts-settings";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const ruleId = parseInt(id);
  if (!Number.isFinite(ruleId)) {
    return Response.json({ error: "invalid_id" }, { status: 400 });
  }

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

  const updates: Parameters<typeof updateTTSPronunciationRule>[1] = {};
  if (typeof body.pattern === "string") {
    const v = body.pattern.trim();
    if (!v || v.length > 200) {
      return Response.json({ error: "invalid_pattern" }, { status: 400 });
    }
    updates.pattern = v;
  }
  if (typeof body.replacement === "string") {
    const v = body.replacement.trim();
    if (!v || v.length > 200) {
      return Response.json({ error: "invalid_replacement" }, { status: 400 });
    }
    updates.replacement = v;
  }
  if (body.note === null) {
    updates.note = null;
  } else if (typeof body.note === "string") {
    const v = body.note.trim();
    updates.note = v.length > 0 ? v : null;
  }
  if (typeof body.isActive === "boolean") updates.isActive = body.isActive;
  if (
    typeof body.sortOrder === "number" &&
    Number.isFinite(body.sortOrder)
  ) {
    updates.sortOrder = Math.round(body.sortOrder);
  }

  const ok = await updateTTSPronunciationRule(ruleId, updates);
  if (!ok) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const ruleId = parseInt(id);
  if (!Number.isFinite(ruleId)) {
    return Response.json({ error: "invalid_id" }, { status: 400 });
  }

  const ok = await deleteTTSPronunciationRule(ruleId);
  if (!ok) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}
