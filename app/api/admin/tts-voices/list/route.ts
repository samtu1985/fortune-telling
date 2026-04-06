import { auth } from "@/app/lib/auth";
import { ADMIN_EMAIL } from "@/app/lib/users";
import { getTTSConfig } from "@/app/lib/tts-settings";

async function checkAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.email === ADMIN_EMAIL;
}

export async function GET() {
  if (!(await checkAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const config = await getTTSConfig();
  console.log("[tts-voices] Config:", { hasKey: !!config?.apiKey, keyLength: config?.apiKey?.length });
  if (!config?.apiKey) {
    return Response.json({ error: "TTS API key not configured", voices: [] }, { status: 200 });
  }

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": config.apiKey },
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[tts-voices] ElevenLabs error:", res.status, errBody.slice(0, 200));
      return Response.json({ error: `ElevenLabs API error: ${res.status}`, voices: [] }, { status: 200 });
    }

    const data = await res.json();
    const voices = (data.voices || []).map((v: Record<string, unknown>) => ({
      voice_id: v.voice_id,
      name: v.name,
      language: v.labels && typeof v.labels === "object" ? (v.labels as Record<string, string>).language || "" : "",
      accent: v.labels && typeof v.labels === "object" ? (v.labels as Record<string, string>).accent || "" : "",
      description: v.labels && typeof v.labels === "object" ? (v.labels as Record<string, string>).description || "" : "",
      use_case: v.labels && typeof v.labels === "object" ? (v.labels as Record<string, string>).use_case || "" : "",
      gender: v.labels && typeof v.labels === "object" ? (v.labels as Record<string, string>).gender || "" : "",
      category: v.category || "",
    }));

    return Response.json({ voices });
  } catch (e) {
    console.error("[tts-voices] Failed to fetch voices:", e);
    return Response.json({ error: "Failed to fetch voices", voices: [] }, { status: 200 });
  }
}
