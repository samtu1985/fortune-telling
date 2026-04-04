import { NextRequest } from "next/server";
import { auth } from "@/app/lib/auth";
import { ADMIN_EMAIL } from "@/app/lib/users";
import {
  readAISettings,
  writeAISettings,
  type MasterAIConfig,
} from "@/app/lib/ai-settings";

async function checkAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.email === ADMIN_EMAIL;
}

// GET: return all AI settings (with API keys masked)
export async function GET() {
  if (!(await checkAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  let settings: Record<string, MasterAIConfig> = {};
  try {
    settings = await readAISettings();
  } catch {
    // No settings file yet — return empty
  }

  // Mask API keys for display
  const masked: Record<string, MasterAIConfig & { hasKey: boolean }> = {};
  for (const key of Object.keys(settings)) {
    const config = settings[key];
    masked[key] = {
      provider: config.provider,
      modelId: config.modelId,
      apiKey: config.apiKey ? "••••" + config.apiKey.slice(-4) : "",
      apiUrl: config.apiUrl,
      thinkingMode: config.thinkingMode,
      thinkingBudget: config.thinkingBudget,
      hasKey: !!config.apiKey,
    };
  }

  return Response.json({ settings: masked });
}

// PUT: update AI settings for a specific master key
export async function PUT(request: NextRequest) {
  if (!(await checkAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { key, provider, modelId, apiKey, apiUrl, thinkingMode, thinkingBudget } = body as {
    key: string;
    provider: string;
    modelId: string;
    apiKey?: string;
    apiUrl: string;
    thinkingMode?: string;
    thinkingBudget?: number;
  };

  const validKeys = ["bazi", "ziwei", "zodiac"];
  if (!validKeys.includes(key)) {
    return Response.json({ error: "無效的設定項目" }, { status: 400 });
  }

  if (!provider || !modelId || !apiUrl) {
    return Response.json({ error: "缺少必填欄位" }, { status: 400 });
  }

  try {
    // Read existing settings; if blob doesn't exist yet, start with empty
    let settings: Record<string, { provider: string; modelId: string; apiKey: string; apiUrl: string }> = {};
    try {
      settings = await readAISettings();
    } catch {
      // First time — no existing settings file, start fresh
    }

    // If apiKey is not provided or is the masked placeholder, keep existing key
    let finalApiKey = apiKey || "";
    if (!apiKey || apiKey.startsWith("••••")) {
      finalApiKey = settings[key]?.apiKey || "";
    }

    const entry: MasterAIConfig = { provider, modelId, apiKey: finalApiKey, apiUrl };
    if (provider === "anthropic" && thinkingMode) {
      entry.thinkingMode = thinkingMode as MasterAIConfig["thinkingMode"];
      if (thinkingMode === "enabled" && thinkingBudget) {
        entry.thinkingBudget = thinkingBudget;
      }
    }
    settings[key] = entry;
    await writeAISettings(settings);

    return Response.json({ success: true });
  } catch (e) {
    console.error("[admin/ai-settings] PUT failed:", e);
    return Response.json(
      { error: "儲存 AI 設定失敗" },
      { status: 500 }
    );
  }
}

// DELETE: remove AI settings for a specific master key (revert to default)
export async function DELETE(request: NextRequest) {
  if (!(await checkAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { key } = await request.json();
  if (!key) {
    return Response.json({ error: "缺少 key" }, { status: 400 });
  }

  try {
    const settings = await readAISettings();
    delete settings[key];
    await writeAISettings(settings);
    return Response.json({ success: true });
  } catch (e) {
    console.error("[admin/ai-settings] DELETE failed:", e);
    return Response.json(
      { error: "刪除 AI 設定失敗" },
      { status: 500 }
    );
  }
}
