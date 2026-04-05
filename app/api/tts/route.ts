import { NextRequest } from "next/server";
import { auth } from "@/app/lib/auth";
import { getTTSConfig, getVoiceId } from "@/app/lib/tts-settings";
import { logUsage } from "@/app/lib/usage";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { text, masterKey, locale } = (await request.json()) as {
    text: string;
    masterKey: string;
    locale: string;
  };

  if (!text || !masterKey) {
    return Response.json({ error: "Missing text or masterKey" }, { status: 400 });
  }

  const config = await getTTSConfig();
  console.log("[tts] Config loaded:", { hasKey: !!config?.apiKey, modelId: config?.modelId });
  if (!config || !config.apiKey) {
    return Response.json({ error: "TTS not configured" }, { status: 503 });
  }

  const voiceId = await getVoiceId(masterKey, locale);
  console.log("[tts] Voice lookup:", { masterKey, locale, voiceId });
  if (!voiceId) {
    // Try fallback to zh-Hant
    const fallbackVoice = await getVoiceId(masterKey, "zh-Hant");
    if (!fallbackVoice) {
      return Response.json({ error: "No voice configured for this master" }, { status: 503 });
    }
    return synthesize(config, fallbackVoice, text, masterKey, session.user.email);
  }

  return synthesize(config, voiceId, text, masterKey, session.user.email);
}

async function synthesize(
  config: { apiKey: string; modelId: string; stability: number; similarityBoost: number; style: number; speed: number },
  voiceId: string,
  text: string,
  masterKey: string,
  userEmail: string
): Promise<Response> {
  // Split text if too long (ElevenLabs limit ~5000 chars)
  const MAX_CHARS = 4500;
  const chunks = text.length > MAX_CHARS ? splitText(text, MAX_CHARS) : [text];

  const audioBuffers: ArrayBuffer[] = [];

  for (const chunk of chunks) {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": config.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: chunk,
          model_id: config.modelId,
          voice_settings: {
            stability: config.stability,
            similarity_boost: config.similarityBoost,
            style: config.style,
            speed: config.speed,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown error");
      console.error(`[tts] ElevenLabs error ${response.status}:`, errText);
      return Response.json(
        { error: `TTS API error: ${response.status}` },
        { status: response.status }
      );
    }

    const buffer = await response.arrayBuffer();
    audioBuffers.push(buffer);
  }

  // Log usage (character count)
  logUsage({
    userEmail,
    masterType: masterKey,
    mode: "multi",
    provider: "elevenlabs",
    modelId: config.modelId,
    inputTokens: text.length,
    outputTokens: 0,
  });

  // Combine audio buffers if multiple chunks
  if (audioBuffers.length === 1) {
    return new Response(audioBuffers[0], {
      headers: { "Content-Type": "audio/mpeg" },
    });
  }

  const totalLength = audioBuffers.reduce((sum, b) => sum + b.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of audioBuffers) {
    combined.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }

  return new Response(combined.buffer, {
    headers: { "Content-Type": "audio/mpeg" },
  });
}

function splitText(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxChars) {
    // Find last sentence boundary before maxChars
    let splitIdx = remaining.lastIndexOf("。", maxChars);
    if (splitIdx === -1) splitIdx = remaining.lastIndexOf(".", maxChars);
    if (splitIdx === -1) splitIdx = remaining.lastIndexOf("\n", maxChars);
    if (splitIdx === -1) splitIdx = maxChars; // Hard split if no boundary found
    else splitIdx += 1; // Include the punctuation

    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx);
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}
