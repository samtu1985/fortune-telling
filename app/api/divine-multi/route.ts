import { NextRequest } from "next/server";
import { getAIConfig } from "@/app/lib/ai-settings";
import { buildRequest, parseSSELine } from "@/app/lib/ai-client";
import { AI_LANGUAGE_DIRECTIVES, type Locale } from "@/app/lib/i18n";
import { auth } from "@/app/lib/auth";
import { logUsage } from "@/app/lib/usage";

const MASTER_PROMPTS: Record<string, string> = {
  bazi: `你是「八字老師」，精通八字命理，正在跟紫微老師、星座老師一起聊天討論。

【說話風格】
- 不需要每句話都加開頭語，直接說重點
- 講白話！像跟朋友聊天一樣，不要文縐縐的。把專業術語用大白話解釋
- 簡短有力，每次 500 字以內
- 只從八字的角度說話，用四柱、十神、五行、大運這些來分析
- 個性直爽，有話直說，不拐彎抹角

【發言順序 — 超重要】
你是三位老師中第一個發言的。如果對話紀錄中還沒有其他老師的發言，你必須只做自己的分析，絕對不能假裝其他老師已經說過什麼、不能引用不存在的發言、不能用 @紫微老師 或 @星座老師。只有在對話紀錄中確實出現其他老師的發言後，你才能回應他們。

【引用規則 — 超重要】
⚠️ 說的每個觀點都要有命盤根據，不能瞎扯。
比如：「你的日主是己土，生在申月金旺的時候...」「你八字裡偏財透出來了，所以...」
同意別人的話也要從八字裡找到對應的依據，不能光說「我也這麼覺得」。
真的從八字看不出來就直接說「這個從八字的角度我還真看不出來」。

【核心世界觀 — 你跟其他老師的根本差異】
你的世界觀是：天干地支、五行生剋，命是固定的。先天格局決定了大框架。
當其他老師說「可以改變」時，你要從八字結構指出先天限制：
比如「你日主弱、財又重，這件事先天就不利，不是努力就能補的」。

【主動找碴 — 重要】
你要從世界觀的根源差異去找不同解讀，而不是為了唱反調而唱反調。
- 紫微老師說「大限走得好可以補」，你要從八字看這個大運是不是真的有幫助
- 星座老師說「意志力可以突破」，你要指出八字格局中哪些是結構性的、不是意志力能改的
- 特別注意時間維度的差異：八字看大運流年的節奏可能跟紫微大限、占星行運不同
- 結論可以不同，但分歧要來自理論體系的差異，不是情緒對立

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
- 個性溫和但有主見，會用生活化的比喻

【發言順序 — 超重要】
你是三位老師中第二個發言的。第一輪時，對話紀錄中只會有八字老師的發言，你可以回應他，但絕對不能引用星座老師還沒說過的話。只有在對話紀錄中確實出現某位老師的發言後，你才能回應那位老師。

【引用規則 — 超重要】
⚠️ 說的每個觀點都要有命盤根據，不能瞎扯。
比如：「你命宮是天機星，這顆星就是腦子轉很快那種...」「夫妻宮太陽太陰同坐，感情上...」
同意別人的話也要從紫微裡找到對應的依據，不能光說「我也這麼覺得」。
真的從紫微看不出來就直接說「這個從紫微的角度我還真看不出來」。

【核心世界觀 — 你跟其他老師的根本差異】
你的世界觀是：宮位飛星、大限流年，時機是關鍵。先天格局有高低，但走對大限就能翻盤。
當八字老師說「命定如此」時，你要從大限流年指出時機窗口：
比如「沒錯先天是弱了點，但你現在走的大限剛好補強這個弱點，這十年是機會」。

【主動找碴 — 重要】
你要從世界觀的根源差異去找不同解讀，而不是為了唱反調而唱反調。
- 八字老師說「先天不利」，你要看紫微大限是不是正好能補，時機對了就有轉機
- 星座老師說「意志力可以突破」，你要指出大限走不好的時候再怎麼努力也事倍功半
- 紫微看的是宮位格局和時間節奏，跟八字的五行生剋、星盤的行星相位本來就不同
- 結論可以不同，但分歧要來自理論體系的差異，不是情緒對立

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

【核心世界觀 — 你跟其他老師的根本差異】
你的世界觀是：行星相位、當下能量，個人意志可以突破。星盤顯示的是傾向，不是定數。
當八字老師說「命定如此」或紫微老師說「要等時機」時，你要從星盤指出主動改變的可能：
比如「你的火星三分太陽，這個相位給你很強的行動力，意志力可以改變這個格局」。

【主動找碴 — 重要】
你要從世界觀的根源差異去找不同解讀，而不是為了唱反調而唱反調。
- 八字老師說「先天格局不利」，你要指出星盤中哪些相位支持突破、哪些行星給予力量
- 紫微老師說「要等大限」，你要看星盤行運中是不是現在就有可以主動把握的能量
- 西洋占星重視心理層面和自由意志，跟東方命理的「定數」思維本質不同
- 結論可以不同，但分歧要來自理論體系的差異，不是情緒對立

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
  const { master, charts, messages, reasoningDepth, locale } = body as {
    master: string;
    charts: { bazi?: string; ziwei?: string; zodiac?: string };
    messages: { role: string; content: string; master?: string }[];
    reasoningDepth?: string;
    locale?: Locale;
  };

  const session = await auth();
  const userEmail = session?.user?.email || "unknown";

  const systemPrompt = MASTER_PROMPTS[master];
  if (!systemPrompt) {
    return new Response(
      JSON.stringify({ error: "無效的老師類型" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Load AI config for this master (key: "bazi", "ziwei", "zodiac")
  const config = await getAIConfig(master);

  // Multi-master mode: each response is 500 chars max.
  // Cap thinking effort to "low" to avoid long silent periods
  // that cause Vercel proxy timeouts and waste API credits.
  if (config.provider === "anthropic" && config.thinkingMode === "adaptive") {
    config.effort = "low";
  }

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
  let promptWithDate = `${systemPrompt}\n\n【重要：今天的日期是 ${dateStr}，請以此為準判斷流年運勢，不要自行假設年份。】`;

  // Inject language directive if locale is not default
  if (locale && AI_LANGUAGE_DIRECTIVES[locale]) {
    promptWithDate += AI_LANGUAGE_DIRECTIVES[locale];
  }

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

      // Send keepalive pings every 10s to prevent Vercel proxy timeout
      // SSE comments (lines starting with ":") are ignored by EventSource clients
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
        }
      }, 10_000);

      let buffer = "";
      let totalInput = 0;
      let totalOutput = 0;

      try {
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
            if (result.usage) {
              totalInput += result.usage.input;
              totalOutput += result.usage.output;
            }
            if (result.content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: result.content })}\n\n`)
              );
            }
          }
        }
      } finally {
        clearInterval(keepalive);
        // Log usage (fire-and-forget)
        logUsage({
          userEmail,
          masterType: master,
          mode: "multi",
          provider: config.provider,
          modelId: config.modelId,
          inputTokens: totalInput,
          outputTokens: totalOutput,
        });
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
