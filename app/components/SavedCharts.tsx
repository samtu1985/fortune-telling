"use client";

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

const TYPE_LABELS: Record<string, string> = {
  bazi: "八字命盤",
  ziwei: "紫微命盤",
  zodiac: "星盤",
};

export default function SavedCharts({ type, profiles, onStartChat }: SavedChartsProps) {
  const chartKey = type as keyof NonNullable<Profile["savedCharts"]>;
  const withCharts = profiles.filter((p) => p.savedCharts?.[chartKey]);
  const label = TYPE_LABELS[type] || "命盤";

  if (withCharts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-stone/50">
          尚未保存任何{label}
        </p>
        <p className="text-xs text-stone/30 mt-2">
          選擇檔案並生成命盤後，可點擊「保存命盤」來收藏
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {withCharts.map((p) => (
        <details
          key={p.id}
          className="border border-gold/10 rounded-lg overflow-hidden"
          style={{ background: "rgba(var(--glass-rgb), 0.02)" }}
        >
          <summary className="px-4 py-3 cursor-pointer hover:bg-gold/5 transition-colors flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gold font-serif">{p.label}</span>
              {p.birthDate && (
                <span className="text-xs text-stone/40">{p.birthDate}</span>
              )}
              {p.gender && (
                <span className="text-xs text-stone/40">{p.gender}</span>
              )}
            </div>
            <svg className="w-4 h-4 text-stone/30 transition-transform details-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </summary>
          <div className="px-4 pb-4 border-t border-gold/5">
            <pre className="text-xs text-stone/70 leading-relaxed whitespace-pre-wrap mt-3 max-h-96 overflow-y-auto">
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
                className="mt-3 w-full py-2.5 rounded-sm text-sm text-gold border border-gold/20 bg-gold/10 hover:bg-gold/20 transition-colors font-serif tracking-widest"
              >
                以此命盤開始 AI 分析
              </button>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
