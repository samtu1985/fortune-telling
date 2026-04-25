import { NextRequest } from "next/server";
import { generateBaziChart } from "@/app/lib/bazi";
import { generateZiweiChart } from "@/app/lib/ziwei";
import { generateNatalChart } from "@/app/lib/astrology";
import { getAIConfig } from "@/app/lib/ai-settings";
import { buildRequest, parseSSELine } from "@/app/lib/ai-client";
import { AI_LANGUAGE_DIRECTIVES, type Locale } from "@/app/lib/i18n";
import { auth } from "@/app/lib/auth";
import { logUsage } from "@/app/lib/usage";
import { getUserWithQuota } from "@/app/lib/users";
import { checkQuota, consumeQuota } from "@/app/lib/quota";
import { generateHumanDesignChart, generateTransit, HumanDesignApiError } from "@/app/lib/humandesign";
import { serializeForPrompt as serializeHumanDesignForPrompt } from "@/app/lib/humandesign/serialize";

// Helper: extract birth data from any message text (structured or natural language)
function parseBirthData(content: string): {
  birthDate: string;
  birthTime: string;
  gender: string;
  birthPlace: string;
  isLunar: boolean;
  isLeapMonth: boolean;
} | null {
  let birthDate: string | null = null;
  let birthTime: string | null = null;

  // Try structured format: 出生日期：YYYY-MM-DD / 出生時間：HH:MM
  const structDateMatch = content.match(/出生日期[：:]\s*(\S+)/);
  const structTimeMatch = content.match(/出生時間[：:]\s*(\S+)/);

  if (structDateMatch && structTimeMatch) {
    birthDate = structDateMatch[1].replace(/（.*）/, "");
    birthTime = structTimeMatch[1].replace(/（.*）/, "");
  } else {
    // Flexible date: YYYY-MM-DD, YYYY/MM/DD, YYYY年M月D日
    const flexDateMatch = content.match(/(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})日?/);
    // Flexible time: 下午3點30分, 15:00, 3點, 凌晨2點
    const flexTimeMatch = content.match(/(凌晨|早上|上午|中午|下午|傍晚|晚上)?(\d{1,2})[點時:：](\d{0,2})分?/);

    if (flexDateMatch) {
      birthDate = `${flexDateMatch[1]}-${flexDateMatch[2].padStart(2, "0")}-${flexDateMatch[3].padStart(2, "0")}`;
    }
    if (flexTimeMatch) {
      let h = parseInt(flexTimeMatch[2]);
      const period = flexTimeMatch[1];
      if (period === "下午" || period === "傍晚" || period === "晚上") {
        if (h < 12) h += 12;
      } else if (period === "凌晨" || period === "早上" || period === "上午") {
        if (h === 12) h = 0;
      } else if (period === "中午") {
        if (h === 12) h = 12;
        else if (h < 12) h += 12;
      }
      const m = flexTimeMatch[3] || "00";
      birthTime = `${h.toString().padStart(2, "0")}:${m.padStart(2, "0")}`;
    }
  }

  if (!birthDate || !birthTime) return null;

  // Gender
  const genderStructMatch = content.match(/性別[：:]\s*(男|女)/);
  const genderFlexMatch = content.match(/(男生|女生|男性|女性)/);
  let gender = "男";
  if (genderStructMatch) gender = genderStructMatch[1];
  else if (genderFlexMatch) gender = genderFlexMatch[1].startsWith("女") ? "女" : "男";

  // Place
  const placeMatch =
    content.match(/出生地點[：:]\s*(\S+)/) ||
    content.match(/出生地[：:]\s*(\S+)/) ||
    content.match(/出生在(\S+)/);
  const birthPlace = placeMatch?.[1] || "";

  // Calendar type
  const calendarMatch =
    content.match(/（(農曆(?:（閏月）)?|國曆)）/) ||
    content.match(/(農曆|陰曆|閏月)/);
  const calendarStr = calendarMatch?.[1] || "";
  const isLunar = calendarStr.includes("農曆") || calendarStr.includes("陰曆");
  const isLeapMonth = calendarStr.includes("閏月");

  return { birthDate, birthTime, gender, birthPlace, isLunar, isLeapMonth };
}

// Generate chart text for a given type and birth data
function generateChartForType(
  type: string,
  data: { birthDate: string; birthTime: string; gender: string; birthPlace: string; isLunar: boolean; isLeapMonth: boolean }
): string | null {
  try {
    if (type === "bazi") {
      return generateBaziChart({
        birthDate: data.birthDate,
        birthTime: data.birthTime,
        gender: data.gender,
        isLunar: data.isLunar,
        isLeapMonth: data.isLeapMonth,
      });
    }
    if (type === "ziwei") {
      return generateZiweiChart({
        birthDate: data.birthDate,
        birthTime: data.birthTime,
        gender: data.gender,
        isLunar: data.isLunar,
        isLeapMonth: data.isLeapMonth,
      });
    }
    if (type === "zodiac" && data.birthPlace) {
      return generateNatalChart({
        birthDate: data.birthDate,
        birthTime: data.birthTime,
        birthPlace: data.birthPlace,
      }) || null;
    }
  } catch (e) {
    console.error(`[divine] Failed to generate ${type} chart:`, e);
  }
  return null;
}

// Gemini models tend to be clinical and formulaic. This directive adds warmth.
const GEMINI_TONE_DIRECTIVE = `

【說話風格 — 非常重要】
你不是在寫論文或報告，你是在跟一個真實的人聊他的人生。請做到：

1. 像一個有智慧的長輩在跟晚輩聊天，溫暖、接地氣、有同理心
2. 不要用「根據命盤顯示」「由此可見」這種教科書語氣，改成「你這個人啊...」「說白了就是...」「你有沒有覺得自己...」
3. 先共情，再分析。比如不要直接說「你的財運不佳」，而是「賺錢這件事對你來說可能一直有種使不上力的感覺，對吧？」
4. 適時用比喻和生活化的例子，讓命理概念變得好懂
5. 給建議的時候要具體、可行動，不要空泛的「宜多注意」
6. 保持鼓勵的基調，即使是不利的格局也要點出轉機和可以努力的方向
7. 可以偶爾用輕鬆的語氣調侃，但不要失去專業感
8. 每段分析都要回扣到這個人的真實生活可能碰到的情境`;

const FOLLOWUP_CHART_RULE = `

【追問中的命盤計算規則】
如果使用者在追問中提供了其他人的出生資料（例如想做合盤、比較、或幫他人看命），
系統會自動為該人計算命盤，並以對應的標籤附加在該訊息中。
你同樣必須完全依照這些程式計算的數據進行解讀，不得自行排盤或編造任何數據。
若追問訊息中未附帶程式計算的命盤數據，代表系統無法解析該人的出生資訊——
此時你應該請使用者提供完整的出生資料（日期、時間、性別、地點），而不是自行推算。`;

const SYSTEM_PROMPTS: Record<string, string> = {
  bazi: `你是一位精通八字命理的命盤「解讀者」。你的唯一職責是解讀由排盤程式計算好的命盤數據。

【最重要的規則】
使用者的八字命盤已由專業排盤程式（lunar-typescript 萬年曆）精確計算完成。
計算結果會以 <bazi-chart> 標籤提供，包含四柱、十神、藏干、五行統計、大運、流年等完整資料。
你必須且只能使用這些數據，不得自行排盤或修改任何四柱、十神、藏干。

⚠️ 常見錯誤警告：AI 模型經常忽略提供的命盤數據，改為根據出生日期自行推算四柱干支。
這會導致命盤數據錯誤。你絕對不能犯這個錯誤。

【回覆格式要求】
你的回覆必須按照以下結構：

第一部分「命盤總覽」：逐一列出 <bazi-chart> 中的關鍵數據（原文引用，不得修改）：
- 四柱：[從命盤數據複製年柱、月柱、日柱、時柱]
- 日主：[從命盤數據複製]
- 五行統計：[從命盤數據複製]

第二部分起才進行解讀分析，內容應包含：
1. 日主強弱判斷（根據五行統計和十神配置）
2. 格局分析（正官格、食神格、偏財格等）
3. 十神配置解讀（各柱十神的意義與相互關係）
4. 五行喜忌分析
5. 大運走勢解讀（結合大運干支與命盤的生剋關係）
6. 近期流年運勢
7. 性格特質與人生建議
8. 感情、事業、健康的整體運勢

注意：本系統排盤使用的是使用者輸入的鐘錶時間（標準時間），並未自動進行真太陽時校正。
如果使用者提供了出生地點，請根據出生地的經度說明真太陽時與鐘錶時間的差異：
- 明確告知使用者目前命盤是以鐘錶時間排列
- 若校正後時辰可能改變，請列出兩種時辰的差異供使用者自行判斷

請以溫和、富有智慧的語氣回答，避免過於絕對的斷言。`,

  ziwei: `你是一位精通紫微斗數的命盤「解讀者」。你的唯一職責是解讀由排盤程式計算好的命盤數據。

【最重要的規則】
使用者的紫微斗數命盤已由專業排盤程式（iztro + fortel-ziweidoushu 雙重驗證）精確計算完成。
計算結果會以 <ziwei-chart> 標籤提供。你必須且只能使用這些數據。
你不得自行排盤，也不得修改或質疑程式排出的星曜位置、宮位配置、四化飛星。

⚠️ 常見錯誤警告：AI 模型經常忽略提供的命盤數據，改為根據出生日期自行推算星曜位置。
這會導致命盤數據錯誤。你絕對不能犯這個錯誤。

【回覆格式要求】
你的回覆必須按照以下結構：

第一部分「命盤總覽」：列出 <ziwei-chart> 中的關鍵數據（原文引用，不得修改）：
- 命宮主星：[從命盤數據複製]
- 五行局：[從命盤數據複製]
- 命主/身主：[從命盤數據複製]
- 各宮位主星配置摘要

第二部分起才進行解讀分析，內容應包含：
1. 命盤格局總覽（命宮主星、五行局、命主身主的意義）
2. 十二宮位重點分析（命宮、財帛宮、官祿宮、夫妻宮、福德宮等）
3. 四化星（祿權科忌）的影響分析
4. 主星特質與性格分析
5. 煞星與輔星的影響
6. 大限與流年運勢概述
7. 人生重要轉折點提示
8. 整體建議與開運方向

請以深厚的學理為基礎，語氣溫和且富有洞察力。`,

  zodiac: `你是一位精通西洋占星術的星盤「解讀者」。你的唯一職責是解讀由天文程式計算好的星盤數據。

【最重要的規則】
使用者的出生星盤已由 Moshier 星曆表（精確度達角分級別）+ Placidus 宮位制計算完成。
計算結果會以 <natal-chart> 標籤提供。你必須且只能使用這些數據。

⚠️ 常見錯誤警告：AI 模型經常忽略提供的星盤數據，改為根據出生日期自行推算行星位置。
這會導致除太陽星座外的所有數據全部錯誤，因為 AI 無法精確計算月亮、上升點等天文位置。
你絕對不能犯這個錯誤。

【回覆格式要求】
你的回覆必須按照以下結構：

第一部分「星盤總覽」：逐一列出 <natal-chart> 中的關鍵數據（原文引用，不得修改任何度數或星座）：
- 上升點 (ASC)：[從星盤數據複製]
- 太陽：[從星盤數據複製]
- 月亮：[從星盤數據複製]
- 水星：[從星盤數據複製]
- 金星：[從星盤數據複製]
- 火星：[從星盤數據複製]
（以及其他重要行星）

第二部分起才進行解讀分析，內容應包含：
1. 太陽星座、月亮星座、上升星座的三重解讀
2. 重要行星的星座與宮位意義
3. 主要相位的影響分析（合相、對分、三分、四分、六分）
4. 星盤格局與特殊配置（T-Square、Grand Trine 等）
5. 性格特質與人生主題
6. 感情、事業與個人成長建議
7. 當前行運的影響（如果適用）

請以溫和、富有智慧的語氣回答，避免過於絕對的斷言。`,

  humandesign: `你是一位資深的設計圖解讀師。資料以兩個標籤提供：
- <humandesign-chart>JSON</humandesign-chart> ：使用者的本命能量設計圖（type / strategy / authority / profile / definition / centers / channels / planets 等）。這是長期穩定的核心。
- <humandesign-transit>JSON</humandesign-transit> ：當下時刻的流年星象（同樣含 planets / gates / channels / centers，附 datetime 時間戳）。這是當下大環境正在啟動的能量。

你必須且只能使用上述 JSON 的欄位作為依據。

解讀流程：
1. 先以 chart.summary 中的 type / strategy / authority / profile / definition 描繪整體能量圖像（200-300 字），語氣自然、具象、鼓勵實驗。
2. 針對使用者的具體問題，援引相關的 centers（已定義 / 未定義）、啟動中的 channels 或關鍵 gates 作依據做具體回答。
3. 若使用者問到「流年」「近期」「當下」「最近」「現在」等與時間有關的問題，比對 <humandesign-transit> 與 <humandesign-chart>：
   - 流年 gates 中與本命 activatedGates 重疊的閘門 → 此刻被「強化共振」，能量加倍明顯。
   - 流年 channels 中跨越本命未定義中心的 → 此刻外境會「臨時補全」這個中心，是體驗的好時機。
   - 流年行星的 gate.line 與本命行星的 gate.line 形成的疊加 → 點出對應主題。
   - 引用時請帶上日期（datetime 欄位裡的年月日），讓使用者知道是哪段時期的能量。
4. 提出 1-2 個「可以實驗的具體行動」，對齊該 authority 的決策模式。

規範：
- 不使用「Human Design」商標名稱，也不直接引述 Ra Uru Hu 的專屬文案；以「設計圖 / 能量圖 / 能量設計」等中性詞語描述。
- 避免命定論語氣；用「可以觀察 / 邀請你實驗」式語言。
- 避免算命式宣告，著重自我覺察與實踐。
- 流年資料若缺失（未提供 transit 標籤），則明說「目前未取得當下流年資料」，不要編造。`,
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { type, messages: chatMessages, reasoningDepth, locale } = body as {
    type: string;
    messages: { role: string; content: string; images?: string[] }[];
    reasoningDepth?: string;
    locale?: Locale;
  };

  const session = await auth();
  const userEmail = session?.user?.email || "unknown";

  // Load user for quota check. Uses getUserWithQuota (not getUser) because
  // getUser returns a narrow UserData type that omits quota columns.
  const quotaUser =
    userEmail !== "unknown" ? await getUserWithQuota(userEmail) : null;

  if (!quotaUser) {
    return new Response(
      JSON.stringify({ error: "未登入或使用者不存在" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const quota = checkQuota(quotaUser, "single");
  if (!quota.ok) {
    return Response.json(
      { error: "quota_exhausted", reason: quota.reason, canPurchase: quota.canPurchase },
      { status: 402 }
    );
  }

  let systemPrompt = SYSTEM_PROMPTS[type];
  if (!systemPrompt) {
    return new Response(
      JSON.stringify({ error: "無效的命理類型" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Load AI config (shared key for both single and multi-master modes)
  const config = await getAIConfig(type);
  console.log(`[divine] ${type} → ${config.provider} / ${config.modelId}`);
  if (!config.apiKey) {
    return new Response(
      JSON.stringify({ error: `AI 引擎尚未設定 API Key (${type})` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Inject current date so the model knows the actual year
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  systemPrompt += `\n\n【重要：今天的日期是 ${dateStr}，請以此為準判斷流年運勢，不要自行假設年份。】`;

  // Add follow-up chart rule to system prompt
  systemPrompt += FOLLOWUP_CHART_RULE;

  // For Gemini models: inject warmth and conversational tone directive
  // Gemini tends to be clinical and formulaic without explicit guidance
  if (config.provider === "google") {
    systemPrompt += GEMINI_TONE_DIRECTIVE;
  }

  // Inject language directive LAST so it takes highest priority
  if (locale && AI_LANGUAGE_DIRECTIVES[locale]) {
    systemPrompt += AI_LANGUAGE_DIRECTIVES[locale];
  }

  console.log(`[divine] locale=${locale}, directive=${AI_LANGUAGE_DIRECTIVES[locale as Locale]?.slice(0, 30) || "none"}`);

  // Human Design: chart is async (external API); fetch once from the first user
  // message's birthData and inject into the system prompt. If this fails, return
  // BEFORE consumeQuota, so no quota is charged on chart failure.
  // If consumeQuota is ever moved earlier in this handler, add a refundQuota
  // helper to app/lib/quota.ts and call it in the catch branch below.
  if (type === "humandesign") {
    const firstUserMsg = chatMessages.find((m) => m.role === "user");
    const birthData = firstUserMsg ? parseBirthData(firstUserMsg.content) : null;
    if (birthData) {
      try {
        const hdChart = await generateHumanDesignChart(
          {
            date: birthData.birthDate,
            time: birthData.birthTime,
            city: birthData.birthPlace,
          },
          { calendarType: birthData.isLunar ? "lunar" : "solar" },
        );
        systemPrompt += `\n\n【以下是由排盤程式精確計算的能量設計圖資料，你必須完全依照這些資料進行解讀，不得自行推算或修改】\n\n${serializeHumanDesignForPrompt(hdChart)}`;

        // Also fetch the current-moment transit so the AI can answer 流年 / current
        // energy questions without the user having to ask the UI to fetch it.
        // Cost: 0.5 cr per fresh hour (server-side hourly cache); failure here is
        // non-fatal — natal analysis still works without transit.
        try {
          const transit = await generateTransit({ city: birthData.birthPlace });
          // Compact JSON: planets, gates, channels, centers, datetime — drop raw.
          const transitPayload = {
            datetime: transit.meta.datetime,
            planets: transit.planets,
            gates: transit.gates,
            channels: transit.channels,
            centers: transit.centers,
          };
          systemPrompt += `\n\n【以下是「當下流年」的星象資料（${transit.meta.datetime}），可用來回答關於流年運勢、近期能量的問題；本命資料優先，流年資料為補充】\n\n<humandesign-transit>${JSON.stringify(transitPayload)}</humandesign-transit>`;
        } catch (e) {
          console.warn("[divine] humandesign transit fetch failed (non-fatal):", e);
        }
      } catch (e) {
        if (e instanceof HumanDesignApiError) {
          const statusMap: Record<string, number> = {
            not_configured: 422,
            auth: 502,
            invalid_input: 400,
            unavailable: 503,
            invalid_response: 500,
          };
          return new Response(
            JSON.stringify({ error: `humandesign_${e.code}`, message: e.message }),
            { status: statusMap[e.code] ?? 500, headers: { "Content-Type": "application/json" } },
          );
        }
        console.error("[divine] humandesign unexpected:", e);
        return new Response(
          JSON.stringify({ error: "humandesign_unknown" }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
    }
  }

  // Collect generated charts for client-side saving
  const generatedCharts: { index: number; chart: string }[] = [];

  // Process ALL user messages: generate charts for any message containing birth data
  const processedMessages = chatMessages.map((msg, index) => {
    if (msg.role !== "user") return msg;

    // Skip if message already contains injected chart data (e.g., from @mention on the client)
    if (msg.content.includes("由排盤程式精確計算的命盤數據") || msg.content.includes("由排盤程式為此人精確計算的命盤數據")) {
      return msg;
    }

    const birthData = parseBirthData(msg.content);
    if (!birthData) return msg;

    const chartText = generateChartForType(type, birthData);

    if (index === 0) {
      // First message: inject chart into system prompt (higher authority)
      if (chartText) {
        const tagMap: Record<string, string> = {
          bazi: "不得自行排盤或修改任何四柱干支",
          ziwei: "不得自行排盤或修改任何星曜位置",
          zodiac: "不得自行推算或修改任何行星位置",
        };
        systemPrompt += `\n\n【以下是由排盤程式精確計算的命盤數據，你必須完全依照這些數據進行解讀，${tagMap[type] || "不得自行排盤"}】\n\n${chartText}`;
        generatedCharts.push({ index, chart: chartText });
      } else if (type === "zodiac" && birthData.birthPlace) {
        systemPrompt += `\n\n【系統提示】無法查詢到「${birthData.birthPlace}」的座標資料，星盤未能自動生成。請僅根據出生日期提供太陽星座分析，並提醒使用者：缺少精確座標將無法計算上升星座與宮位配置。`;
      }
      return msg; // first message content stays unchanged
    } else {
      // Follow-up messages: inject chart into message content
      if (chartText) {
        generatedCharts.push({ index, chart: chartText });
        return {
          ...msg,
          content: msg.content + `\n\n【以下是由排盤程式為此人精確計算的命盤數據，你必須完全依照這些數據進行解讀，不得自行排盤或編造任何數據】\n\n${chartText}`,
        };
      }
      return msg;
    }
  });

  // Convert messages: if a message has images, use multimodal content format
  const apiMessages = processedMessages.map((msg) => {
    if (msg.images && msg.images.length > 0) {
      return {
        role: msg.role,
        content: [
          { type: "text" as const, text: msg.content },
          ...msg.images.map((img) => ({
            type: "image_url" as const,
            image_url: { url: img },
          })),
        ],
      };
    }
    return { role: msg.role, content: msg.content };
  });

  const req = buildRequest(config, {
    systemPrompt,
    messages: apiMessages,
    reasoningDepth,
    maxCompletionTokens: 16384,
  });

  console.log(`[divine] Request to ${req.url}`, { model: (req.body as Record<string,unknown>).model, provider: config.provider });

  const response = await fetch(req.url, {
    method: "POST",
    headers: req.headers,
    body: JSON.stringify(req.body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[divine] ${config.provider} API error ${response.status}:`, errorText);
    // Extract human-readable error message
    let errorMsg = `AI API 錯誤: ${response.status}`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error?.message) errorMsg += ` — ${parsed.error.message}`;
    } catch { /* use default */ }
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: response.status, headers: { "Content-Type": "application/json" } }
    );
  }

  // AI call succeeded (HTTP 2xx). Consume one credit atomically before we
  // start streaming so a false return (concurrent request burned the last
  // credit between our check and consume) can still yield a 402.
  const consumed = await consumeQuota(quotaUser, "single");
  if (!consumed) {
    return Response.json(
      { error: "quota_exhausted", reason: "exhausted", canPurchase: quotaUser.canPurchase },
      { status: 402 }
    );
  }
  console.log("[credits] single credit consumed for:", userEmail);

  // Stream the response back to the client
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      // Emit chart data for client-side chart saving
      for (const { index, chart } of generatedCharts) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ chartData: chart, messageIndex: index })}\n\n`)
        );
      }

      let totalInput = 0;
      let totalOutput = 0;

      let buffer = "";
      let chunkCount = 0;
      let parsedCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        chunkCount++;
        if (chunkCount <= 3) {
          console.log(`[divine] SSE chunk #${chunkCount} (${chunk.length} bytes):`, chunk.slice(0, 300));
        }
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);

          const result = parseSSELine(data, req.isAnthropic);
          if (!result) {
            if (parsedCount === 0 && data !== "[DONE]") {
              console.log("[divine] parseSSELine returned null for:", data.slice(0, 200));
            }
            continue;
          }
          parsedCount++;
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
          if (result.reasoning) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ reasoning: result.reasoning })}\n\n`)
            );
          }
        }
      }

      console.log(`[divine] Stream ended. Chunks: ${chunkCount}, Parsed results: ${parsedCount}, Tokens: in=${totalInput} out=${totalOutput}`);

      // Log usage (fire-and-forget)
      logUsage({
        userEmail,
        masterType: type,
        mode: "single",
        provider: config.provider,
        modelId: config.modelId,
        inputTokens: totalInput,
        outputTokens: totalOutput,
      });

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
