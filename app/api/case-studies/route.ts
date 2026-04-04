import { NextRequest } from "next/server";
import { auth } from "@/app/lib/auth";
import { getAIConfig } from "@/app/lib/ai-settings";
import { buildRequest } from "@/app/lib/ai-client";
import { db } from "@/app/lib/db";
import { caseStudies } from "@/app/lib/db/schema";

const ANONYMIZE_PROMPT = `You are a data anonymization assistant. Given a fortune-telling conversation between three masters (八字/紫微/星座) and a user, you must:

1. Remove ALL personally identifiable information (PII): exact birth dates, names, locations, emails, any identifying details
2. Replace with generalized descriptions (e.g., "1990年代出生的女性", "東亞某城市", "某用戶")
3. Keep ALL divination analysis, master opinions, and insights intact
4. Generate a concise summary (100-200 characters) highlighting the key insights

Return ONLY valid JSON in this exact format:
{"summary": "案例摘要...", "anonymizedContent": "完整的匿名化對話內容..."}

Do not include any text outside the JSON object.`;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messages, question } = (await request.json()) as {
    messages: { role: string; content: string; master?: string }[];
    question: string;
  };

  if (!messages?.length) {
    return Response.json({ error: "No messages provided" }, { status: 400 });
  }

  // Build conversation text for AI to anonymize
  const masterLabels: Record<string, string> = {
    bazi: "八字老師",
    ziwei: "紫微老師",
    zodiac: "星座老師",
  };

  const conversationText = messages
    .filter((m) => m.role === "assistant" && m.master)
    .map((m) => `【${masterLabels[m.master!] || m.master}】\n${m.content}`)
    .join("\n\n---\n\n");

  const userQuestion = messages.find((m) => m.role === "user")?.content || question;

  const fullText = `使用者的問題：\n${userQuestion}\n\n===\n\n${conversationText}`;

  // Use bazi master's AI config for the anonymization call
  const config = await getAIConfig("bazi");
  if (!config.apiKey) {
    return Response.json({ error: "AI not configured" }, { status: 500 });
  }

  const req = buildRequest(config, {
    systemPrompt: ANONYMIZE_PROMPT,
    messages: [{ role: "user", content: fullText }],
    maxCompletionTokens: 4096,
  });

  // Non-streaming call
  const aiResponse = await fetch(req.url, {
    method: "POST",
    headers: req.headers,
    body: JSON.stringify({ ...req.body, stream: false }),
  });

  if (!aiResponse.ok) {
    console.error("[case-studies] AI call failed:", aiResponse.status);
    return Response.json({ error: "AI processing failed" }, { status: 500 });
  }

  const aiData = await aiResponse.json();

  // Extract content from response (handle both OpenAI and Anthropic formats)
  let content: string;
  if (req.isAnthropic) {
    content = aiData.content?.[0]?.text || "";
  } else {
    content = aiData.choices?.[0]?.message?.content || "";
  }

  // Parse JSON from AI response
  let parsed: { summary: string; anonymizedContent: string };
  try {
    // Try to extract JSON from the response (AI might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.summary || !parsed.anonymizedContent) throw new Error("Missing fields");
  } catch (e) {
    console.error("[case-studies] Failed to parse AI response:", e, content);
    return Response.json({ error: "Failed to process response" }, { status: 500 });
  }

  // Save to database
  const result = await db
    .insert(caseStudies)
    .values({
      summary: parsed.summary,
      fullContent: parsed.anonymizedContent,
      originalQuestion: parsed.anonymizedContent.split("\n")[0] || question,
      masterTypes: "bazi,ziwei,zodiac",
    })
    .returning({ id: caseStudies.id });

  return Response.json({
    id: result[0]?.id,
    summary: parsed.summary,
  }, { status: 201 });
}
