import { NextRequest } from "next/server";
import { auth } from "@/app/lib/auth";
import { generateHumanDesignImage, HumanDesignApiError } from "@/app/lib/humandesign";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const { birthDate, birthTime, birthPlace, isLunar } = body as {
    birthDate?: string;
    birthTime?: string;
    birthPlace?: string;
    isLunar?: boolean;
  };
  if (!birthDate || !birthTime || !birthPlace) {
    return Response.json({ error: "缺少必要參數" }, { status: 400 });
  }
  try {
    const buffer = await generateHumanDesignImage(
      { date: birthDate, time: birthTime, city: birthPlace },
      { calendarType: isLunar ? "lunar" : "solar" },
    );
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    if (e instanceof HumanDesignApiError) {
      const map: Record<string, number> = {
        not_configured: 422,
        auth: 502,
        invalid_input: 400,
        unavailable: 503,
        invalid_response: 500,
      };
      return Response.json(
        { error: `humandesign_${e.code}`, message: e.message },
        { status: map[e.code] ?? 500 },
      );
    }
    console.error("[humandesign/image] unexpected:", e);
    return Response.json({ error: "humandesign_unknown" }, { status: 500 });
  }
}
