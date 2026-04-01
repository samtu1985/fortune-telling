import { NextRequest } from "next/server";

const BYTEPLUS_API_URL =
  "https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions";

const MASTER_PROMPTS: Record<string, string> = {
  bazi: `你是「八字老師」，一位精通八字命理的大師，正與紫微斗數老師和西洋星座老師進行一場命理圓桌討論。

【你的身份與風格】
- 你的每句話必須以「我從八字的觀點來看，」開頭
- 言簡意賅，每次回覆控制在 150 字以內
- 你只從八字命理的角度分析，引用四柱、十神、五行、大運等概念
- 你可以用 @紫微老師 或 @星座老師 來回應或引用他們的觀點
- 語氣沉穩內斂，如資深命理師

【重要規則】
你的八字命盤數據由排盤程式精確計算，以 <bazi-chart> 標籤提供。
你必須且只能使用這些數據，不得自行排盤或修改任何四柱干支。
使用繁體中文。`,

  ziwei: `你是「紫微老師」，一位精通紫微斗數的大師，正與八字老師和西洋星座老師進行一場命理圓桌討論。

【你的身份與風格】
- 你的每句話必須以「我從紫微的觀點來看，」開頭
- 言簡意賅，每次回覆控制在 150 字以內
- 你只從紫微斗數的角度分析，引用命宮主星、宮位、四化、大限等概念
- 你可以用 @八字老師 或 @星座老師 來回應或引用他們的觀點
- 語氣溫和睿智，帶有洞察力

【重要規則】
你的紫微斗數命盤由排盤程式精確計算，以 <ziwei-chart> 標籤提供。
你必須且只能使用這些數據，不得自行排盤或修改任何星曜位置。
使用繁體中文。`,

  zodiac: `你是「星座老師」，一位精通西洋占星術的大師，正與八字老師和紫微斗數老師進行一場命理圓桌討論。

【你的身份與風格】
- 你的每句話必須以「我從星座的觀點來看，」開頭
- 言簡意賅，每次回覆控制在 150 字以內
- 你只從西洋占星的角度分析，引用行星、星座、宮位、相位等概念
- 你可以用 @八字老師 或 @紫微老師 來回應或引用他們的觀點
- 語氣開放現代，富有哲思

【重要規則】
你的出生星盤由天文程式精確計算，以 <natal-chart> 標籤提供。
你必須且只能使用這些數據，不得自行推算或修改任何行星位置。
使用繁體中文。`,
};

const MASTER_LABELS: Record<string, string> = {
  bazi: "八字老師",
  ziwei: "紫微老師",
  zodiac: "星座老師",
};

export async function POST(request: NextRequest) {
  const apiKey = process.env.BYTEPLUS_API_KEY;
  const modelId = process.env.BYTEPLUS_MODEL_ID || "seed-2-0-pro-260328";

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "API Key 尚未設定" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await request.json();
  const { master, charts, messages, reasoningDepth } = body as {
    master: string;
    charts: { bazi?: string; ziwei?: string; zodiac?: string };
    messages: { role: string; content: string; master?: string }[];
    reasoningDepth?: string;
  };

  const systemPrompt = MASTER_PROMPTS[master];
  if (!systemPrompt) {
    return new Response(
      JSON.stringify({ error: "無效的老師類型" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Inject this master's chart data into system prompt
  const chartKey = master as keyof typeof charts;
  const chartData = charts[chartKey] || "";
  const fullSystemPrompt = chartData
    ? `${systemPrompt}\n\n【以下是由排盤程式精確計算的命盤數據】\n\n${chartData}`
    : systemPrompt;

  // Convert multi-master messages to API format:
  // - This master's messages → "assistant"
  // - Other masters' messages → "user" (with label prefix)
  // - User messages → "user"
  const apiMessages = messages.map((msg) => {
    if (msg.role === "user") {
      return { role: "user" as const, content: msg.content };
    }
    // Assistant messages from masters
    if (msg.master === master) {
      return { role: "assistant" as const, content: msg.content };
    }
    // Other masters' messages — present as user context
    const label = msg.master ? MASTER_LABELS[msg.master] || msg.master : "其他老師";
    return { role: "user" as const, content: `【${label}的發言】${msg.content}` };
  });

  const response = await fetch(BYTEPLUS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: fullSystemPrompt },
        ...apiMessages,
      ],
      thinking: { type: reasoningDepth === "off" ? "disabled" : "enabled" },
      ...(reasoningDepth && reasoningDepth !== "off" && { reasoning_effort: reasoningDepth }),
      max_completion_tokens: 4096,
      stream: true,
      stream_options: { include_usage: true },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return new Response(
      JSON.stringify({ error: `API 錯誤: ${response.status}`, details: errorText }),
      { status: response.status, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: delta.content })}\n\n`)
              );
            }
          } catch {
            // skip
          }
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
