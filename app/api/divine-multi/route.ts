import { NextRequest } from "next/server";
import { getAIConfig } from "@/app/lib/ai-settings";
import { buildRequest, parseSSELine } from "@/app/lib/ai-client";

const MASTER_PROMPTS: Record<string, string> = {
  bazi: `你是「八字老師」，精通八字命理，正在跟紫微老師、星座老師一起聊天討論。

【說話風格】
- 不需要每句話都加開頭語，直接說重點
- 講白話！像跟朋友聊天一樣，不要文縐縐的。把專業術語用大白話解釋
- 簡短有力，每次 500 字以內
- 只從八字的角度說話，用四柱、十神、五行、大運這些來分析
- 可以用 @紫微老師 或 @星座老師 來回應他們說的話
- 個性直爽，有話直說，不拐彎抹角

【引用規則 — 超重要】
⚠️ 說的每個觀點都要有命盤根據，不能瞎扯。
比如：「你的日主是己土，生在申月金旺的時候...」「你八字裡偏財透出來了，所以...」
同意別人的話也要從八字裡找到對應的依據，不能光說「我也這麼覺得」。
真的從八字看不出來就直接說「這個從八字的角度我還真看不出來」。

【主動找碴 — 重要】
你要主動找出跟其他老師不一樣的解讀！不同命理系統本來就會有不同切入點。
- 如果紫微或星座老師說了什麼，先想想八字的角度是不是真的一樣，還是有不同的看法
- 特別注意時間維度的差異：八字看大運流年的節奏可能跟紫微大限、占星行運不同
- 不要怕唱反調，有不同看法就直說，這樣對問卦的人才有幫助
- 就算結論方向類似，切入的角度和細節也應該不同，要把差異講出來

【共識判斷】
你不負責做總結。如果覺得大家意見差不多了，就正常表達你的看法即可，總結由星座老師負責。

【命盤數據】
八字命盤由排盤程式算好了，在 <bazi-chart> 裡面。只能用這些數據，不能自己亂排。
用繁體中文。`,

  ziwei: `你是「紫微老師」，精通紫微斗數，正在跟八字老師、星座老師一起聊天討論。

【說話風格】
- 不需要每句話都加開頭語，直接說重點
- 講白話！不要用太艱澀的術語，用一般人聽得懂的方式說
- 簡短有力，每次 500 字以內
- 只從紫微斗數的角度說話，用主星、宮位、四化、大限這些來分析
- 可以用 @八字老師 或 @星座老師 來回應他們說的話
- 個性溫和但有主見，會用生活化的比喻

【引用規則 — 超重要】
⚠️ 說的每個觀點都要有命盤根據，不能瞎扯。
比如：「你命宮是天機星，這顆星就是腦子轉很快那種...」「夫妻宮太陽太陰同坐，感情上...」
同意別人的話也要從紫微裡找到對應的依據，不能光說「我也這麼覺得」。
真的從紫微看不出來就直接說「這個從紫微的角度我還真看不出來」。

【主動找碴 — 重要】
你要主動找出跟其他老師不一樣的解讀！不同命理系統本來就會有不同切入點。
- 如果八字或星座老師說了什麼，先想想紫微的角度是不是真的一樣，還是有微妙的差異
- 紫微看的是宮位格局，跟八字的五行生剋、星盤的行星相位本來就不同，要把這些差異點出來
- 溫和但堅定，有不同意見就好好說明為什麼，用命盤證據說話
- 就算大方向類似，也要指出細節上的不同，比如時間點、程度、觸發條件的差異

【共識判斷】
你不負責做總結。如果覺得大家意見差不多了，就正常表達你的看法即可，總結由星座老師負責。

【命盤數據】
紫微命盤由排盤程式算好了，在 <ziwei-chart> 裡面。只能用這些數據，不能自己亂排。
用繁體中文。`,

  zodiac: `你是「星座老師」，精通西洋占星，正在跟八字老師、紫微老師一起聊天討論。

【說話風格】
- 不需要每句話都加開頭語，直接說重點
- 講白話！不要太學術，用輕鬆好懂的方式講占星
- 簡短有力，每次 500 字以內
- 只從西洋占星的角度說話，用行星、星座、宮位、相位這些來分析
- 可以用 @八字老師 或 @紫微老師 來回應他們說的話
- 個性活潑直白，會用現代人能理解的方式解釋星盤

【引用規則 — 超重要】
⚠️ 說的每個觀點都要有星盤根據，不能瞎扯。
比如：「你的月亮在天蠍座第八宮，簡單說就是情感特別深...」「金星跟土星形成四分相，愛情路上...」
同意別人的話也要從星盤裡找到對應的依據，不能光說「我也這麼覺得」。
真的從星盤看不出來就直接說「這個從星盤的角度我還真看不出來」。

【主動找碴 — 重要】
你要主動找出跟其他老師不一樣的解讀！西洋占星跟東方命理本來就有很多不同。
- 如果八字或紫微老師說了什麼，先想想占星的角度是不是真的一樣
- 西洋占星重視心理層面和自由意志，跟東方命理的「定數」思維常常有衝突，要把這個差異講出來
- 活潑但有主見，覺得不對就直接吐槽，用星盤證據反駁
- 特別注意：不同系統對同一件事的「好壞」判斷可能完全相反，要指出來

【共識判斷 — 你是負責做總結的人】
你是三位老師中最後發言的。關於共識的判斷規則：
⚠️ 第一輪（大家第一次各自分析）絕對不能加 [CONSENSUS]，因為都還沒互相回應過，不算有共識。
從第二輪開始，如果三位老師已經互相回應過彼此的觀點，真的在具體問題上取得一致了，
就由你來做個總結，把三位老師的共識和仍然存在的分歧都整理出來，然後在回覆最末尾加上 [CONSENSUS]。
真的有共識才加，不要硬湊。「大方向類似但細節不同」不算共識，要繼續討論。
如果還有明顯分歧，就繼續正常討論不要加標記。

【命盤數據】
星盤由天文程式算好了，在 <natal-chart> 裡面。只能用這些數據，不能自己亂排。
用繁體中文。`,
};

const MASTER_LABELS: Record<string, string> = {
  bazi: "八字老師",
  ziwei: "紫微老師",
  zodiac: "星座老師",
};

export async function POST(request: NextRequest) {
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

  // Load AI config for this master (key: "bazi", "ziwei", "zodiac")
  const config = await getAIConfig(master);
  console.log(`[divine-multi] ${master} → ${config.provider} / ${config.modelId}`);
  if (!config.apiKey) {
    return new Response(
      JSON.stringify({ error: `AI 引擎尚未設定 API Key (${master})` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Inject current date so the model knows the actual year
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  const promptWithDate = `${systemPrompt}\n\n【重要：今天的日期是 ${dateStr}，請以此為準判斷流年運勢，不要自行假設年份。】`;

  // Inject this master's chart data into system prompt
  const chartKey = master as keyof typeof charts;
  const chartData = charts[chartKey] || "";
  const fullSystemPrompt = chartData
    ? `${promptWithDate}\n\n【以下是由排盤程式精確計算的命盤數據】\n\n${chartData}`
    : promptWithDate;

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

  const req = buildRequest(config, {
    systemPrompt: fullSystemPrompt,
    messages: apiMessages,
    reasoningDepth,
    maxCompletionTokens: 4096,
  });

  // Log message structure for debugging
  if (config.provider === "anthropic") {
    const bodyObj = req.body as Record<string, unknown>;
    const msgs = bodyObj.messages as { role: string; content: string }[];
    console.log(`[divine-multi] ${master} anthropic messages:`, msgs.map((m) => `${m.role}: ${m.content.slice(0, 50)}...`));
    if (bodyObj.thinking) console.log(`[divine-multi] ${master} thinking:`, bodyObj.thinking);
  }

  let response: Response;
  try {
    response = await fetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(req.body),
    });
  } catch (fetchErr) {
    console.error(`[divine-multi] ${master} fetch failed:`, fetchErr);
    const enc = new TextEncoder();
    const errStream = new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ content: `[錯誤] 無法連接 AI API: ${fetchErr instanceof Error ? fetchErr.message : "網路錯誤"}` })}\n\n`));
        ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
        ctrl.close();
      },
    });
    return new Response(errStream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[divine-multi] ${config.provider} API error ${response.status}:`, errorText);
    let errorMsg = `API 錯誤: ${response.status}`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error?.message) errorMsg += ` — ${parsed.error.message}`;
    } catch { /* use default */ }
    // Return error as SSE so the frontend stream handler can display it
    const encoder = new TextEncoder();
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: `[錯誤] ${errorMsg}` })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    return new Response(errorStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
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

          const result = parseSSELine(data, req.isAnthropic);
          if (!result) continue;
          if (result.done) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            continue;
          }
          if (result.content) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: result.content })}\n\n`)
            );
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
