import { NextRequest } from "next/server";
import { generateBaziChart } from "@/app/lib/bazi";
import { generateZiweiChart } from "@/app/lib/ziwei";
import { generateNatalChart } from "@/app/lib/astrology";
import { generateHumanDesignChart, HumanDesignApiError } from "@/app/lib/humandesign";
import { auth } from "@/app/lib/auth";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const { type, birthDate, birthTime, gender, birthPlace, isLunar, isLeapMonth } = body as {
    type: string;
    birthDate: string;
    birthTime: string;
    gender?: string;
    birthPlace?: string;
    isLunar?: boolean;
    isLeapMonth?: boolean;
  };

  if (!type || !birthDate || !birthTime) {
    return Response.json({ error: "缺少必要參數" }, { status: 400 });
  }

  if (type === "humandesign" && !birthPlace) {
    return Response.json({ error: "缺少出生地" }, { status: 400 });
  }

  try {
    let chart: string | null = null;

    if (type === "bazi") {
      chart = generateBaziChart({
        birthDate,
        birthTime,
        gender: gender || "男",
        isLunar: isLunar || false,
        isLeapMonth: isLeapMonth || false,
      });
    } else if (type === "ziwei") {
      chart = generateZiweiChart({
        birthDate,
        birthTime,
        gender: gender || "男",
        isLunar: isLunar || false,
        isLeapMonth: isLeapMonth || false,
      });
    } else if (type === "zodiac") {
      chart = generateNatalChart({
        birthDate,
        birthTime,
        birthPlace: birthPlace || "",
      }) || null;
    } else if (type === "humandesign") {
      try {
        const hdChart = await generateHumanDesignChart(
          {
            date: birthDate,
            time: birthTime,
            city: birthPlace ?? "",
          },
          { calendarType: isLunar ? "lunar" : "solar" },
        );
        // Return structured chart data. Different shape from bazi/ziwei/zodiac string chart.
        return Response.json({ chart: hdChart });
      } catch (e) {
        if (e instanceof HumanDesignApiError) {
          const statusMap: Record<string, number> = {
            not_configured: 422,
            auth: 502,
            invalid_input: 400,
            unavailable: 503,
            invalid_response: 500,
          };
          return Response.json(
            { error: `humandesign_${e.code}`, message: e.message },
            { status: statusMap[e.code] ?? 500 },
          );
        }
        console.error("[chart] humandesign unexpected:", e);
        return Response.json({ error: "humandesign_unknown" }, { status: 500 });
      }
    } else {
      return Response.json({ error: "無效的命理類型" }, { status: 400 });
    }

    if (!chart) {
      return Response.json(
        { error: type === "zodiac" ? "無法查詢到該地點的座標資料" : "命盤生成失敗" },
        { status: 400 }
      );
    }

    return Response.json({ chart });
  } catch (e) {
    console.error("[chart] Failed to generate chart:", e);
    return Response.json({ error: "命盤生成失敗" }, { status: 500 });
  }
}
