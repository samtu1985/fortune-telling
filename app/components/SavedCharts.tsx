"use client";

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

interface SavedChartsProps {
  type: "bazi" | "ziwei" | "zodiac";
  profiles: Profile[];
  onStartChat?: (profile: Profile, chart: string) => void;
}

export default function SavedCharts({ type, profiles, onStartChat }: SavedChartsProps) {
  const { t } = useLocale();
  const chartKey = type as keyof NonNullable<Profile["savedCharts"]>;
  const withCharts = profiles.filter((p) => p.savedCharts?.[chartKey]);

  const TYPE_LABELS: Record<string, string> = {
    bazi: t("charts.bazi"),
    ziwei: t("charts.ziwei"),
    zodiac: t("charts.zodiac"),
  };
  const label = TYPE_LABELS[type] || t("charts.chart");

  if (withCharts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-text-placeholder">
          {t("charts.noCharts", { label })}
        </p>
        <p className="text-xs text-text-placeholder mt-2">
          {t("charts.howToSave")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {withCharts.map((p) => (
        <details
          key={p.id}
          className="border border-border-light rounded-lg overflow-hidden"
                  >
          <summary className="px-4 py-3 cursor-pointer hover:bg-bg-secondary transition-colors flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-accent">{p.label}</span>
              {p.birthDate && (
                <span className="text-xs text-text-placeholder">{p.birthDate}</span>
              )}
              {p.gender && (
                <span className="text-xs text-text-placeholder">{p.gender}</span>
              )}
            </div>
            <svg className="w-4 h-4 text-text-placeholder transition-transform details-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </summary>
          <div className="px-4 pb-4 border-t border-border-light">
            <pre className="text-xs text-text-tertiary leading-relaxed whitespace-pre-wrap mt-3 max-h-96 overflow-y-auto">
              {p.savedCharts![chartKey]!
                .replace(/<[^>]+>/g, "")
                .trim()}
            </pre>
            {onStartChat && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onStartChat(p, p.savedCharts![chartKey]!);
                }}
                className="mt-3 w-full py-2.5 rounded text-sm text-accent border border-accent/20 bg-accent/10 hover:bg-accent/20 transition-colors"
              >
                {t("charts.startAnalysis")}
              </button>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
