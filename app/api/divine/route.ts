import { NextRequest } from "next/server";
import { generateBaziChart } from "@/app/lib/bazi";
import { generateZiweiChart } from "@/app/lib/ziwei";
import { generateNatalChart } from "@/app/lib/astrology";
import { getAIConfig } from "@/app/lib/ai-settings";
import { buildRequest, parseSSELine } from "@/app/lib/ai-client";

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

請以溫和、富有智慧的語氣回答，避免過於絕對的斷言。
使用繁體中文回答。`,

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

請以深厚的學理為基礎，語氣溫和且富有洞察力。
使用繁體中文回答。`,

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

請以溫和、富有智慧的語氣回答，避免過於絕對的斷言。
使用繁體中文回答，但可以保留星座和行星的英文名稱作為參考。`,
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { type, messages: chatMessages, reasoningDepth } = body as {
    type: string;
    messages: { role: string; content: string; images?: string[] }[];
    reasoningDepth?: string;
  };

  let systemPrompt = SYSTEM_PROMPTS[type];
  if (!systemPrompt) {
    return new Response(
      JSON.stringify({ error: "無效的命理類型" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Load AI config (shared key for both single and multi-master modes)
  const config = await getAIConfig(type);
  if (!config.apiKey) {
    return new Response(
      JSON.stringify({ error: `AI 引擎尚未設定 API Key (${type})` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Add follow-up chart rule to system prompt
  systemPrompt += FOLLOWUP_CHART_RULE;

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

  const response = await fetch(req.url, {
    method: "POST",
    headers: req.headers,
    body: JSON.stringify(req.body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return new Response(
      JSON.stringify({ error: `AI API 錯誤: ${response.status}`, details: errorText }),
      { status: response.status, headers: { "Content-Type": "application/json" } }
    );
  }

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
          if (result.reasoning) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ reasoning: result.reasoning })}\n\n`)
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
