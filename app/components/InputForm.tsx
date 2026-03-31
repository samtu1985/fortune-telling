"use client";

import { useState, useEffect, useRef } from "react";

interface InputFormProps {
  type: "bazi" | "ziwei" | "zodiac";
  onSubmit: (message: string, images?: string[]) => void;
  loading: boolean;
}

function compressImage(dataUrl: string, maxWidth = 1024): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.src = dataUrl;
  });
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
  const [isLeapMonth, setIsLeapMonth] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isChineseType = type === "bazi" || type === "ziwei";

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 20 * 1024 * 1024) continue;
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const compressed = await compressImage(dataUrl);
      setImages((prev) => [...prev, compressed]);
    }
    e.target.value = "";
  };

  // Auto-fill from saved profile (server-side)
  useEffect(() => {
    const loadProfile = () => {
      fetch("/api/profile")
        .then((res) => res.json())
        .then((data) => {
          if (data.profile) {
            if (data.profile.birthDate) setBirthDate(data.profile.birthDate);
            if (data.profile.birthTime) setBirthTime(data.profile.birthTime);
            if (data.profile.gender) setGender(data.profile.gender);
            if (data.profile.birthPlace) setBirthPlace(data.profile.birthPlace);
          }
        })
        .catch(() => {});
    };

    loadProfile();
    window.addEventListener("profile-updated", loadProfile);
    return () => window.removeEventListener("profile-updated", loadProfile);
  }, [type]);

  const buildMessage = () => {
    const shichen = isChineseType && birthTime ? timeToShichen(birthTime) : "";

    const calendarLabel = calendarType === "lunar"
      ? `農曆${isLeapMonth ? "（閏月）" : ""}`
      : "國曆";

    if (type === "bazi") {
      return `出生日期：${birthDate}（${calendarLabel}）
出生時間：${birthTime}${shichen ? `（${shichen}）` : ""}
出生地點：${birthPlace}
性別：${gender || "未提供"}
${question ? `特別想了解的方向：${question}` : "請進行完整的八字分析。"}`;
    }
    if (type === "ziwei") {
      return `出生日期：${birthDate}（${calendarLabel}）
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
    if (type === "ziwei" && !gender) return;
    onSubmit(buildMessage(), images.length > 0 ? images : undefined);
    setImages([]);
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
          {type === "zodiac" && (
            <p className="text-xs text-stone/60 mt-1">
              上升星座約每 2 小時更換，時間越精確結果越準確
            </p>
          )}
          {isChineseType && (
            <p className="text-xs text-stone/60 mt-1">
              若出生時間在時辰交界附近，結果可能因時辰不同而有差異
            </p>
          )}
        </div>

        {/* Calendar Type (Chinese only) */}
        {isChineseType && (
          <div className="space-y-1.5">
            <label>曆法</label>
            <select value={calendarType} onChange={(e) => { setCalendarType(e.target.value); setIsLeapMonth(false); }}>
              <option value="solar">國曆（陽曆）</option>
              <option value="lunar">農曆（陰曆）</option>
            </select>
            {calendarType === "lunar" && (
              <label className="flex items-center gap-2 mt-1.5 text-xs text-stone/70 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isLeapMonth}
                  onChange={(e) => setIsLeapMonth(e.target.checked)}
                  className="accent-gold"
                />
                該月為閏月
              </label>
            )}
          </div>
        )}

        {/* Gender (Chinese only) */}
        {isChineseType && (
          <div className="space-y-1.5">
            <label>性別{type === "ziwei" ? " *" : ""}</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              required={type === "ziwei"}
            >
              {type === "ziwei" ? (
                <>
                  <option value="">請選擇</option>
                  <option value="男">男</option>
                  <option value="女">女</option>
                </>
              ) : (
                <>
                  <option value="">不提供</option>
                  <option value="男">男</option>
                  <option value="女">女</option>
                </>
              )}
            </select>
            {type === "ziwei" && (
              <p className="text-xs text-stone/60 mt-1">
                紫微斗數需依性別決定大限順逆走向，為必填欄位
              </p>
            )}
          </div>
        )}

        {/* Birth Place */}
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
              出生地資訊將提供給 AI 參考，系統未自動校正真太陽時
            </p>
          )}
          {type === "zodiac" && (
            <p className="text-xs text-stone/60 mt-1">
              需精確出生時間以計算上升星座；僅支援常見城市座標查詢
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

      {/* Image Upload */}
      <div className="space-y-1.5">
        <label>上傳圖片（選填）</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          className="hidden"
        />
        <div className="flex flex-wrap gap-3 items-start">
          {images.map((img, i) => (
            <div key={i} className="relative group">
              <img
                src={img}
                alt=""
                className="w-20 h-20 object-cover rounded border border-gold/20"
              />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-seal text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-20 h-20 rounded border border-dashed border-gold/20 text-gold-dim/60 hover:border-gold/40 hover:text-gold-dim transition-colors flex flex-col items-center justify-center gap-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-[10px]">上傳</span>
          </button>
        </div>
        <p className="text-xs text-stone/50">
          可上傳手相、面相、命盤截圖等圖片供 AI 參考分析
        </p>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !birthDate || !birthTime || !birthPlace || (type === "ziwei" && !gender)}
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
