"use client";

import { useState } from "react";

interface Profile {
  id: string;
  label: string;
  birthDate: string;
  birthTime: string;
  gender: string;
  birthPlace: string;
  calendarType: string;
  isLeapMonth: boolean;
  savedCharts?: {
    bazi?: string;
    ziwei?: string;
    zodiac?: string;
  };
}

export interface ChartRequest {
  type: "bazi" | "ziwei" | "zodiac";
  birthDate: string;
  birthTime: string;
  gender: string;
  birthPlace: string;
  calendarType: string;
  isLeapMonth: boolean;
  profileId?: string;
  profileLabel?: string;
}

interface InputFormProps {
  type: "bazi" | "ziwei" | "zodiac";
  onSubmit: (request: ChartRequest) => void;
  loading: boolean;
  profiles: Profile[];
  onProfilesChange: () => void;
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

export function timeToShichen(time: string): string {
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

export default function InputForm({ type, onSubmit, loading, profiles, onProfilesChange }: InputFormProps) {
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [gender, setGender] = useState("");
  const [calendarType, setCalendarType] = useState("solar");
  const [zodiacSign, setZodiacSign] = useState("");
  const [isLeapMonth, setIsLeapMonth] = useState(false);

  const isChineseType = type === "bazi" || type === "ziwei";

  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [saveLabel, setSaveLabel] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [showSavedChart, setShowSavedChart] = useState(false);

  const handleProfileSelect = (profileId: string) => {
    setSelectedProfileId(profileId);
    if (!profileId) {
      setBirthDate("");
      setBirthTime("");
      setGender("");
      setBirthPlace("");
      setCalendarType("solar");
      setIsLeapMonth(false);
      setSaveLabel("");
      return;
    }
    const p = profiles.find((pr) => pr.id === profileId);
    if (p) {
      setBirthDate(p.birthDate);
      setBirthTime(p.birthTime);
      setGender(p.gender);
      setBirthPlace(p.birthPlace);
      setCalendarType(p.calendarType || "solar");
      setIsLeapMonth(p.isLeapMonth || false);
      setSaveLabel(p.label);
    }
  };

  const handleSaveProfile = async () => {
    if (!saveLabel.trim()) return;
    setSavingProfile(true);
    try {
      const body = {
        label: saveLabel.trim(),
        birthDate,
        birthTime,
        gender,
        birthPlace,
        calendarType,
        isLeapMonth,
      };
      let updated = profiles;
      if (selectedProfileId) {
        const res = await fetch(`/api/profiles/${selectedProfileId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          updated = profiles.map((p) => (p.id === selectedProfileId ? { ...p, ...body } : p));
        }
      } else {
        const res = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            setSelectedProfileId(data.profile.id);
            updated = [...profiles, data.profile];
          }
        }
      }
      window.dispatchEvent(new CustomEvent("profiles-updated", { detail: updated }));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!birthDate || !birthTime || !birthPlace) return;
    if (type === "ziwei" && !gender) return;
    const selectedProfile = profiles.find((p) => p.id === selectedProfileId);
    onSubmit({
      type,
      birthDate,
      birthTime,
      gender,
      birthPlace,
      calendarType,
      isLeapMonth,
      profileId: selectedProfileId || undefined,
      profileLabel: selectedProfile?.label,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="animate-fade-in-up space-y-5"
      style={{ animationDelay: "400ms", opacity: 0 }}
    >
      <div className="gold-line mb-6" />

      {/* Profile Selector */}
      <div className="space-y-1.5">
        <label>選擇檔案</label>
        <select value={selectedProfileId} onChange={(e) => handleProfileSelect(e.target.value)}>
          <option value="">手動輸入</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Saved Chart Button */}
      {selectedProfileId && (() => {
        const sp = profiles.find((p) => p.id === selectedProfileId);
        const chartKey = type as keyof NonNullable<Profile["savedCharts"]>;
        const savedChart = sp?.savedCharts?.[chartKey];
        if (!savedChart) return null;
        return (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowSavedChart(!showSavedChart)}
              className="text-sm text-gold-dim hover:text-gold transition-colors flex items-center gap-1.5"
            >
              <svg className={`w-3.5 h-3.5 transition-transform ${showSavedChart ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              查看已保存的命盤
            </button>
            {showSavedChart && (
              <div className="text-xs text-stone/70 leading-relaxed whitespace-pre-wrap pl-4 border-l-2 border-gold/15 max-h-48 overflow-y-auto">
                {savedChart}
              </div>
            )}
          </div>
        );
      })()}

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

      {/* Save Profile */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="輸入名稱以保存此檔案"
          value={saveLabel}
          onChange={(e) => setSaveLabel(e.target.value)}
          className="flex-1"
        />
        <button
          type="button"
          onClick={handleSaveProfile}
          disabled={savingProfile || !saveLabel.trim() || (!selectedProfileId && profiles.length >= 10)}
          className="shrink-0 px-4 py-2.5 min-h-[44px] rounded-sm text-sm text-gold-dim border border-gold/15 hover:bg-gold/10 transition-colors font-serif tracking-widest disabled:opacity-40"
        >
          {savingProfile ? "..." : selectedProfileId ? "更新" : "保存"}
        </button>
      </div>
      {!selectedProfileId && profiles.length >= 10 && (
        <p className="text-xs text-stone/50">已達上限 10 筆，請先刪除舊檔案</p>
      )}
      <p className="text-xs text-stone/40">
        已保存 {profiles.length}/10 筆
      </p>

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
            生成中...
          </span>
        ) : (
          "顯示命盤"
        )}
      </button>
    </form>
  );
}
