"use client";

import { useState } from "react";

interface InputFormProps {
  type: "bazi" | "ziwei" | "zodiac";
  onSubmit: (message: string) => void;
  loading: boolean;
}

const ZODIAC_SIGNS = [
  "牡羊座 (Aries)",
  "金牛座 (Taurus)",
  "雙子座 (Gemini)",
  "巨蟹座 (Cancer)",
  "獅子座 (Leo)",
  "處女座 (Virgo)",
  "天秤座 (Libra)",
  "天蠍座 (Scorpio)",
  "射手座 (Sagittarius)",
  "摩羯座 (Capricorn)",
  "水瓶座 (Aquarius)",
  "雙魚座 (Pisces)",
];

function timeToShichen(time: string): string {
  if (!time) return "";
  const [h] = time.split(":").map(Number);
  const shichen = [
    [23, 1, "子時"],
    [1, 3, "丑時"],
    [3, 5, "寅時"],
    [5, 7, "卯時"],
    [7, 9, "辰時"],
    [9, 11, "巳時"],
    [11, 13, "午時"],
    [13, 15, "未時"],
    [15, 17, "申時"],
    [17, 19, "酉時"],
    [19, 21, "戌時"],
    [21, 23, "亥時"],
  ] as const;
  for (const [start, end, name] of shichen) {
    if (start > end) {
      if (h >= start || h < end) return name;
    } else {
      if (h >= start && h < end) return name;
    }
  }
  return "";
}

export default function InputForm({ type, onSubmit, loading }: InputFormProps) {
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [gender, setGender] = useState("");
  const [calendarType, setCalendarType] = useState("solar");
  const [zodiacSign, setZodiacSign] = useState("");
  const [question, setQuestion] = useState("");

  const isChineseType = type === "bazi" || type === "ziwei";

  const buildMessage = () => {
    const shichen = isChineseType && birthTime ? timeToShichen(birthTime) : "";

    if (type === "bazi") {
      return `出生日期：${birthDate}（${calendarType === "lunar" ? "農曆" : "國曆"}）
出生時間：${birthTime}${shichen ? `（${shichen}）` : ""}
出生地點：${birthPlace}
性別：${gender || "未提供"}
${question ? `特別想了解的方向：${question}` : "請進行完整的八字分析。"}`;
    }
    if (type === "ziwei") {
      return `出生日期：${birthDate}（${calendarType === "lunar" ? "農曆" : "國曆"}）
出生時間：${birthTime}${shichen ? `（${shichen}）` : ""}
出生地點：${birthPlace}
性別：${gender || "未提供"}
${question ? `特別想了解的方向：${question}` : "請進行完整的紫微斗數命盤分析。"}`;
    }
    // zodiac
    return `出生日期：${birthDate}
出生時間：${birthTime}
出生地點：${birthPlace}
星座：${zodiacSign || "請根據出生日期判斷"}
${question ? `特別想了解的方向：${question}` : "請進行完整的星座運勢分析。"}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!birthDate || !birthTime || !birthPlace) return;
    onSubmit(buildMessage());
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="animate-fade-in-up space-y-5"
      style={{ animationDelay: "400ms", opacity: 0 }}
    >
      <div className="gold-line mb-6" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Birth Date */}
        <div className="space-y-1.5">
          <label>出生日期 *</label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            required
          />
        </div>

        {/* Birth Time — all types use precise time input */}
        <div className="space-y-1.5">
          <label>出生時間（精確到分鐘）*</label>
          <input
            type="time"
            value={birthTime}
            onChange={(e) => setBirthTime(e.target.value)}
            required
          />
          {isChineseType && birthTime && (
            <p className="text-xs text-gold-dim mt-1">
              對應時辰：{timeToShichen(birthTime)}
            </p>
          )}
        </div>

        {/* Calendar Type (Chinese only) */}
        {isChineseType && (
          <div className="space-y-1.5">
            <label>曆法</label>
            <select value={calendarType} onChange={(e) => setCalendarType(e.target.value)}>
              <option value="solar">國曆（陽曆）</option>
              <option value="lunar">農曆（陰曆）</option>
            </select>
          </div>
        )}

        {/* Gender (Chinese only) */}
        {isChineseType && (
          <div className="space-y-1.5">
            <label>性別</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">不提供</option>
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
          </div>
        )}

        {/* Birth Place — all types need it for true solar time */}
        <div className="space-y-1.5">
          <label>出生地點（城市）*</label>
          <input
            type="text"
            placeholder="例：台北、高雄、東京、紐約"
            value={birthPlace}
            onChange={(e) => setBirthPlace(e.target.value)}
            required
          />
          {isChineseType && (
            <p className="text-xs text-stone/60 mt-1">
              出生地影響真太陽時計算，可能改變實際時辰
            </p>
          )}
        </div>

        {/* Zodiac Sign (Zodiac only) */}
        {type === "zodiac" && (
          <div className="space-y-1.5">
            <label>星座（可自動判斷）</label>
            <select value={zodiacSign} onChange={(e) => setZodiacSign(e.target.value)}>
              <option value="">依出生日期判斷</option>
              {ZODIAC_SIGNS.map((sign) => (
                <option key={sign} value={sign}>
                  {sign}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Optional Question */}
      <div className="space-y-1.5">
        <label>想特別了解的方向（選填）</label>
        <input
          type="text"
          placeholder="例：近期事業運、感情發展、健康狀況..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !birthDate || !birthTime || !birthPlace}
        className={`
          w-full py-3.5 rounded-sm text-base tracking-widest font-serif transition-all duration-500
          ${
            loading || !birthDate || !birthTime
              ? "bg-gold/10 text-gold-dim/50 cursor-not-allowed"
              : "bg-gold/15 text-gold hover:bg-gold/25 active:scale-[0.99]"
          }
          border border-gold/20
        `}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-3">
            <span className="inline-block w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
            推算中...
          </span>
        ) : (
          "開始推算"
        )}
      </button>
    </form>
  );
}
