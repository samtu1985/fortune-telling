"use client";

import { useState } from "react";
import { useLocale } from "./LocaleProvider";

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

const ZODIAC_SIGN_KEYS = [
  "zodiac.aries",
  "zodiac.taurus",
  "zodiac.gemini",
  "zodiac.cancer",
  "zodiac.leo",
  "zodiac.virgo",
  "zodiac.libra",
  "zodiac.scorpio",
  "zodiac.sagittarius",
  "zodiac.capricorn",
  "zodiac.aquarius",
  "zodiac.pisces",
] as const;

const SHICHEN_KEYS = [
  "shichen.zi",
  "shichen.chou",
  "shichen.yin",
  "shichen.mao",
  "shichen.chen",
  "shichen.si",
  "shichen.wu",
  "shichen.wei",
  "shichen.shen",
  "shichen.you",
  "shichen.xu",
  "shichen.hai",
] as const;

export function timeToShichenKey(time: string): string {
  if (!time) return "";
  const [h] = time.split(":").map(Number);
  const shichen = [
    [23, 1, "shichen.zi"],
    [1, 3, "shichen.chou"],
    [3, 5, "shichen.yin"],
    [5, 7, "shichen.mao"],
    [7, 9, "shichen.chen"],
    [9, 11, "shichen.si"],
    [11, 13, "shichen.wu"],
    [13, 15, "shichen.wei"],
    [15, 17, "shichen.shen"],
    [17, 19, "shichen.you"],
    [19, 21, "shichen.xu"],
    [21, 23, "shichen.hai"],
  ] as const;
  for (const [start, end, key] of shichen) {
    if (start > end) {
      if (h >= start || h < end) return key;
    } else {
      if (h >= start && h < end) return key;
    }
  }
  return "";
}

const SHICHEN_KEY_TO_CHINESE: Record<string, string> = {
  "shichen.zi": "子時",
  "shichen.chou": "丑時",
  "shichen.yin": "寅時",
  "shichen.mao": "卯時",
  "shichen.chen": "辰時",
  "shichen.si": "巳時",
  "shichen.wu": "午時",
  "shichen.wei": "未時",
  "shichen.shen": "申時",
  "shichen.you": "酉時",
  "shichen.xu": "戌時",
  "shichen.hai": "亥時",
};

/** @deprecated Use timeToShichenKey with t() for i18n support */
export function timeToShichen(time: string): string {
  const key = timeToShichenKey(time);
  return key ? (SHICHEN_KEY_TO_CHINESE[key] || key) : "";
}

export default function InputForm({ type, onSubmit, loading, profiles, onProfilesChange }: InputFormProps) {
  const { t } = useLocale();
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
      className="animate-fade-in space-y-5"
    >
      <div className="tesla-divider mb-6" />

      {/* Profile Selector */}
      <div className="space-y-1.5">
        <label>{t("form.selectProfile")}</label>
        <select value={selectedProfileId} onChange={(e) => handleProfileSelect(e.target.value)}>
          <option value="">{t("form.manualInput")}</option>
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
              className="text-sm text-text-tertiary hover:text-accent transition-colors flex items-center gap-1.5"
            >
              <svg className={`w-3.5 h-3.5 transition-transform ${showSavedChart ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {t("form.viewSavedChart")}
            </button>
            {showSavedChart && (
              <div className="text-xs text-text-tertiary leading-relaxed whitespace-pre-wrap pl-4 border-l-2 border-border-light max-h-48 overflow-y-auto">
                {savedChart.replace(/<[^>]+>/g, "").trim()}
              </div>
            )}
          </div>
        );
      })()}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Birth Date */}
        <div className="space-y-1.5">
          <label>{t("form.birthDate")} {t("form.required")}</label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            required
            className="w-full min-w-0"
          />
        </div>

        {/* Birth Time — all types use precise time input */}
        <div className="space-y-1.5">
          <label>{t("form.birthTime")} {t("form.required")}</label>
          <input
            type="time"
            value={birthTime}
            onChange={(e) => setBirthTime(e.target.value)}
            required
            className="w-full min-w-0"
          />
          {isChineseType && birthTime && (
            <p className="text-xs text-text-tertiary mt-1">
              {t("form.shichen")}{timeToShichenKey(birthTime) ? t(timeToShichenKey(birthTime)) : ""}
            </p>
          )}
          {type === "zodiac" && (
            <p className="text-xs text-text-tertiary mt-1">
              {t("form.ascendantNote")}
            </p>
          )}
          {isChineseType && (
            <p className="text-xs text-text-tertiary mt-1">
              {t("form.shichenBoundary")}
            </p>
          )}
        </div>

        {/* Calendar Type (Chinese only) */}
        {isChineseType && (
          <div className="space-y-1.5">
            <label>{t("form.calendarType")}</label>
            <select value={calendarType} onChange={(e) => { setCalendarType(e.target.value); setIsLeapMonth(false); }}>
              <option value="solar">{t("form.solar")}</option>
              <option value="lunar">{t("form.lunar")}</option>
            </select>
            {calendarType === "lunar" && (
              <label className="flex items-center gap-2 mt-1.5 text-xs text-text-tertiary cursor-pointer">
                <input
                  type="checkbox"
                  checked={isLeapMonth}
                  onChange={(e) => setIsLeapMonth(e.target.checked)}
                  className="accent-accent"
                />
                {t("form.leapMonth")}
              </label>
            )}
          </div>
        )}

        {/* Gender (Chinese only) */}
        {isChineseType && (
          <div className="space-y-1.5">
            <label>{type === "ziwei" ? t("form.genderRequired") : t("form.gender")}</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              required={type === "ziwei"}
            >
              {type === "ziwei" ? (
                <>
                  <option value="">{t("form.selectGender")}</option>
                  <option value="男">{t("form.male")}</option>
                  <option value="女">{t("form.female")}</option>
                </>
              ) : (
                <>
                  <option value="">{t("form.noGender")}</option>
                  <option value="男">{t("form.male")}</option>
                  <option value="女">{t("form.female")}</option>
                </>
              )}
            </select>
            {type === "ziwei" && (
              <p className="text-xs text-text-tertiary mt-1">
                {t("form.ziweiGenderNote")}
              </p>
            )}
          </div>
        )}

        {/* Birth Place */}
        <div className="space-y-1.5">
          <label>{t("form.birthPlace")} {t("form.required")}</label>
          <input
            type="text"
            placeholder={t("form.birthPlacePlaceholder")}
            value={birthPlace}
            onChange={(e) => setBirthPlace(e.target.value)}
            required
          />
          {isChineseType && (
            <p className="text-xs text-text-tertiary mt-1">
              {t("form.birthPlaceNote")}
            </p>
          )}
          {type === "zodiac" && (
            <p className="text-xs text-text-tertiary mt-1">
              {t("form.zodiacPlaceNote")}
            </p>
          )}
        </div>

        {/* Zodiac Sign (Zodiac only) */}
        {type === "zodiac" && (
          <div className="space-y-1.5">
            <label>{t("form.zodiacSign")}</label>
            <select value={zodiacSign} onChange={(e) => setZodiacSign(e.target.value)}>
              <option value="">{t("form.autoDetect")}</option>
              {ZODIAC_SIGN_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(key)}
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
          placeholder={t("form.saveProfileLabel")}
          value={saveLabel}
          onChange={(e) => setSaveLabel(e.target.value)}
          className="flex-1"
        />
        <button
          type="button"
          onClick={handleSaveProfile}
          disabled={savingProfile || !saveLabel.trim() || (!selectedProfileId && profiles.length >= 10)}
          className="shrink-0 px-4 py-2.5 min-h-[44px] rounded-sm text-sm text-text-secondary border border-border-light hover:bg-bg-secondary transition-colors disabled:opacity-40"
        >
          {savingProfile ? "..." : selectedProfileId ? t("form.update") : t("form.save")}
        </button>
      </div>
      {!selectedProfileId && profiles.length >= 10 && (
        <p className="text-xs text-text-placeholder">{t("form.profileLimitReached")}</p>
      )}
      <p className="text-xs text-text-placeholder">
        {t("form.profileCount", { count: String(profiles.length) })}
      </p>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !birthDate || !birthTime || !birthPlace || (type === "ziwei" && !gender)}
        className={`
          w-full py-3.5 rounded text-base transition-all duration-500
          ${
            loading || !birthDate || !birthTime
              ? "bg-accent/10 text-text-tertiary cursor-not-allowed"
              : "bg-accent text-white hover:bg-accent/90 active:scale-[0.99]"
          }
        `}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-3">
            <span className="inline-block w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            {t("form.generating")}
          </span>
        ) : (
          t("form.showChart")
        )}
      </button>
    </form>
  );
}
