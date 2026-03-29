import { NextRequest } from "next/server";
import { generateBaziChart } from "@/app/lib/bazi";
import { generateZiweiChart } from "@/app/lib/ziwei";
import { generateNatalChart } from "@/app/lib/astrology";

const BYTEPLUS_API_URL =
  "https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions";

const SYSTEM_PROMPTS: Record<string, string> = {
  bazi: `你是一位精通八字命理的大師，擁有數十年的命理推算經驗。

【重要】使用者的八字命盤已由專業排盤程式（lunar-typescript）精確計算完成，
排盤結果會附在使用者的第一則訊息中，包含四柱、十神、藏干、五行統計、大運、流年等完整資料。
你不需要自行排盤，也絕對不要修改程式排出的四柱和十神。你的任務是根據這份已排好的命盤進行深入解讀。

如果使用者提供了出生地點，請根據出生地的經度進行真太陽時校正說明：
- 若校正後時辰可能改變，請提醒使用者注意

分析內容應包含：
1. 日主強弱判斷（根據五行統計和十神配置）
2. 格局分析（正官格、食神格、偏財格等）
3. 十神配置解讀（各柱十神的意義與相互關係）
4. 五行喜忌分析
5. 大運走勢解讀（結合大運干支與命盤的生剋關係）
6. 近期流年運勢
7. 性格特質與人生建議
8. 感情、事業、健康的整體運勢

請以溫和、富有智慧的語氣回答，避免過於絕對的斷言。
使用繁體中文回答。`,

  ziwei: `你是一位精通紫微斗數的命理大師，對十四主星、輔星、煞星的排列與解讀有深入研究。

【重要】使用者的命盤已由專業排盤程式（iztro）精確計算完成，排盤結果會附在使用者的第一則訊息中。
你不需要自行排盤，也絕對不要修改或質疑程式排出的星曜位置。你的任務是根據這份已排好的命盤進行深入解讀。

分析內容應包含：
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

  zodiac: `你是一位精通西洋占星術的大師，對出生星盤、行星相位、宮位系統有深入研究。

【重要】使用者的出生星盤已由專業天文程式（Moshier 星曆表 + Placidus 宮位制）精確計算完成，
排盤結果會附在使用者的第一則訊息中。你不需要自行計算行星位置或宮位，也絕對不要修改程式算出的數據。
你的任務是根據這份已計算好的星盤進行深入解讀。

分析內容應包含：
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
  const apiKey = process.env.BYTEPLUS_API_KEY;
  const modelId = process.env.BYTEPLUS_MODEL_ID || "seed-2-0-pro-260328";

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "API Key 尚未設定，請在 .env.local 中配置 BYTEPLUS_API_KEY" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await request.json();
  const { type, messages: chatMessages } = body as {
    type: string;
    messages: { role: string; content: string; images?: string[] }[];
  };

  const systemPrompt = SYSTEM_PROMPTS[type];
  if (!systemPrompt) {
    return new Response(
      JSON.stringify({ error: "無效的命理類型" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // For bazi type, generate chart and append to the first user message
  if (type === "bazi" && chatMessages.length > 0) {
    const firstMsg = chatMessages[0];
    if (firstMsg.role === "user") {
      try {
        const dateMatch = firstMsg.content.match(/出生日期：(\S+)/);
        const timeMatch = firstMsg.content.match(/出生時間：(\S+)/);
        const genderMatch = firstMsg.content.match(/性別：(\S+)/);
        const calendarMatch = firstMsg.content.match(/（(農曆|國曆)）/);

        if (dateMatch && timeMatch) {
          const birthDate = dateMatch[1].replace(/（.*）/, "");
          const birthTime = timeMatch[1].replace(/（.*）/, "");
          const gender = genderMatch?.[1] || "男";
          const isLunar = calendarMatch?.[1] === "農曆";

          const chartText = generateBaziChart({
            birthDate,
            birthTime,
            gender,
            isLunar,
          });

          chatMessages[0] = {
            ...firstMsg,
            content: firstMsg.content + "\n\n" + chartText,
          };
        }
      } catch (e) {
        console.error("[divine] Failed to generate bazi chart:", e);
      }
    }
  }

  // For ziwei type, generate chart and prepend to the first user message
  if (type === "ziwei" && chatMessages.length > 0) {
    const firstMsg = chatMessages[0];
    if (firstMsg.role === "user") {
      try {
        // Parse birth info from the user message
        const dateMatch = firstMsg.content.match(/出生日期：(\S+)/);
        const timeMatch = firstMsg.content.match(/出生時間：(\S+)/);
        const genderMatch = firstMsg.content.match(/性別：(\S+)/);
        const calendarMatch = firstMsg.content.match(/（(農曆|國曆)）/);

        if (dateMatch && timeMatch) {
          const birthDate = dateMatch[1].replace(/（.*）/, ""); // Remove （國曆）/（農曆） suffix
          const birthTime = timeMatch[1].replace(/（.*）/, ""); // Remove 時辰 suffix
          const gender = genderMatch?.[1] || "男";
          const isLunar = calendarMatch?.[1] === "農曆";

          const chartText = generateZiweiChart({
            birthDate,
            birthTime,
            gender,
            isLunar,
          });

          // Prepend chart to first message
          chatMessages[0] = {
            ...firstMsg,
            content: firstMsg.content + "\n\n" + chartText,
          };
        }
      } catch (e) {
        console.error("[divine] Failed to generate ziwei chart:", e);
        // Continue without chart — AI will do its best
      }
    }
  }

  // For zodiac type, generate natal chart and append to the first user message
  if (type === "zodiac" && chatMessages.length > 0) {
    const firstMsg = chatMessages[0];
    if (firstMsg.role === "user") {
      try {
        const dateMatch = firstMsg.content.match(/出生日期：(\S+)/);
        const timeMatch = firstMsg.content.match(/出生時間：(\S+)/);
        const placeMatch = firstMsg.content.match(/出生地點：(\S+)/);

        if (dateMatch && timeMatch && placeMatch) {
          const birthDate = dateMatch[1].replace(/（.*）/, "");
          const birthTime = timeMatch[1].replace(/（.*）/, "");
          const birthPlace = placeMatch[1];

          const chartText = generateNatalChart({
            birthDate,
            birthTime,
            birthPlace,
          });

          if (chartText) {
            chatMessages[0] = {
              ...firstMsg,
              content: firstMsg.content + "\n\n" + chartText,
            };
          }
        }
      } catch (e) {
        console.error("[divine] Failed to generate natal chart:", e);
      }
    }
  }

  // Convert messages: if a message has images, use multimodal content format
  const apiMessages = chatMessages.map((msg) => {
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

  const response = await fetch(BYTEPLUS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        ...apiMessages,
      ],
      thinking: { type: "enabled" },
      reasoning_effort: "high",
      max_completion_tokens: 16384,
      stream: true,
      stream_options: { include_usage: true },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return new Response(
      JSON.stringify({ error: `BytePlus API 錯誤: ${response.status}`, details: errorText }),
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
            if (delta?.reasoning_content) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ reasoning: delta.reasoning_content })}\n\n`
                )
              );
            }
          } catch {
            // skip malformed chunks
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
