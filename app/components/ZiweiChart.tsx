"use client";

import { Component, type ReactNode, useState, useEffect, useMemo } from "react";
import { astro } from "iztro";

interface ZiweiChartProps {
  birthday: string;
  birthTime: number;
  gender: "男" | "女";
  birthdayType: "lunar" | "solar";
}

// Earthly branch index → grid position [row, col]
const GRID_MAP: [number, number][] = [
  [3, 0], // 0: 寅
  [2, 0], // 1: 卯
  [1, 0], // 2: 辰
  [0, 0], // 3: 巳
  [0, 1], // 4: 午
  [0, 2], // 5: 未
  [0, 3], // 6: 申
  [1, 3], // 7: 酉
  [2, 3], // 8: 戌
  [3, 3], // 9: 亥
  [3, 2], // 10: 子
  [3, 1], // 11: 丑
];

type PalaceData = {
  name: string;
  heavenlyStem: string;
  earthlyBranch: string;
  isBodyPalace: boolean;
  isOriginalPalace: boolean;
  majorStars: { name: string; brightness?: string; mutagen?: string }[];
  minorStars: { name: string; mutagen?: string }[];
  decadal?: { range: number[] };
};

const MUTAGEN_COLORS: Record<string, string> = {
  "祿": "text-emerald-400",
  "權": "text-amber-400",
  "科": "text-sky-400",
  "忌": "text-red-400",
};

const BRIGHTNESS_OPACITY: Record<string, string> = {
  "廟": "opacity-100",
  "旺": "opacity-90",
  "得": "opacity-80",
  "利": "opacity-70",
  "平": "opacity-60",
  "不": "opacity-50",
  "陷": "opacity-40",
};

function PalaceCell({ palace, isActive }: { palace: PalaceData; isActive: boolean }) {
  const majors = palace.majorStars?.filter((s) => s.name) || [];
  const minors = palace.minorStars?.filter((s) => s.name) || [];

  return (
    <div
      className={`
        border border-border-light p-1.5 sm:p-2 flex flex-col justify-between min-h-[120px] sm:min-h-[140px] transition-colors
        ${isActive ? "bg-accent/10 border-accent/40" : "bg-accent/[0.02]"}
      `}
    >
      {/* Major stars */}
      <div className="space-y-0.5">
        {majors.length > 0 ? (
          majors.map((s, i) => (
            <div key={i} className="flex items-center gap-0.5 flex-wrap">
              <span
                className={`text-xs sm:text-sm font-bold text-text-primary/90 ${
                  s.brightness ? BRIGHTNESS_OPACITY[s.brightness] || "" : ""
                }`}
              >
                {s.name}
              </span>
              {s.brightness && (
                <span className="text-[10px] sm:text-xs text-text-tertiary/60">{s.brightness}</span>
              )}
              {s.mutagen && (
                <span className={`text-[10px] sm:text-xs font-bold ${MUTAGEN_COLORS[s.mutagen] || "text-accent"}`}>
                  {s.mutagen}
                </span>
              )}
            </div>
          ))
        ) : (
          <span className="text-[10px] text-text-tertiary/30">—</span>
        )}
        {/* Minor stars (compact) */}
        {minors.length > 0 && (
          <div className="flex flex-wrap gap-x-1 mt-0.5">
            {minors.slice(0, 4).map((s, i) => (
              <span key={i} className="text-[10px] sm:text-[11px] text-text-tertiary/60">
                {s.name}
                {s.mutagen && (
                  <span className={`${MUTAGEN_COLORS[s.mutagen] || ""}`}>{s.mutagen}</span>
                )}
              </span>
            ))}
            {minors.length > 4 && (
              <span className="text-[10px] text-text-tertiary/40">+{minors.length - 4}</span>
            )}
          </div>
        )}
      </div>

      {/* Footer: palace name + branch */}
      <div className="flex items-end justify-between mt-1">
        <div className="flex items-center gap-0.5">
          <span className={`text-xs sm:text-sm ${isActive ? "text-accent font-bold" : "text-accent/70"}`}>
            {palace.name}
          </span>
          {palace.isBodyPalace && (
            <span className="text-[10px] px-1 bg-accent/20 text-accent rounded">身</span>
          )}
        </div>
        <div className="text-right">
          <span className="text-[10px] sm:text-xs text-text-tertiary/50">
            {palace.heavenlyStem}{palace.earthlyBranch}
          </span>
          {palace.decadal?.range && (
            <div className="text-[10px] text-text-tertiary/40">
              {palace.decadal.range[0]}-{palace.decadal.range[1]}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CenterCell({
  solarDate,
  lunarDate,
  gender,
  fiveElements,
  soul,
  body,
  zodiac,
}: {
  solarDate: string;
  lunarDate: string;
  gender: string;
  fiveElements: string;
  soul: string;
  body: string;
  zodiac: string;
}) {
  return (
    <div className="col-span-2 row-span-2 border border-border-light bg-accent/[0.03] p-3 sm:p-4 flex flex-col items-center justify-center gap-1.5 text-center">
      <div className="text-base sm:text-lg font-bold text-accent">紫微斗數</div>
      <div className="w-12 h-px bg-accent/20" />
      <div className="space-y-0.5 text-[10px] sm:text-xs text-text-primary/70">
        <div>{solarDate}</div>
        <div className="text-text-tertiary/50">{lunarDate}</div>
        <div>{gender} · {zodiac}</div>
      </div>
      <div className="w-12 h-px bg-accent/20" />
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] sm:text-xs">
        <span className="text-text-tertiary/50 text-right">五行局</span>
        <span className="text-text-primary/80">{fiveElements}</span>
        <span className="text-text-tertiary/50 text-right">命主</span>
        <span className="text-text-primary/80">{soul}</span>
        <span className="text-text-tertiary/50 text-right">身主</span>
        <span className="text-text-primary/80">{body}</span>
      </div>
    </div>
  );
}

class ZiweiChartErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[ZiweiChart] render error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="my-4 rounded-lg border border-border-light p-6 text-center text-sm text-text-tertiary/60">
          命盤圖表載入失敗，但不影響 AI 解讀結果。
        </div>
      );
    }
    return this.props.children;
  }
}

function ZiweiChartInner({ birthday, birthTime, gender, birthdayType }: ZiweiChartProps) {
  const [chartData, setChartData] = useState<{
    palaces: PalaceData[];
    solarDate: string;
    lunarDate: string;
    zodiac: string;
    soul: string;
    body: string;
    fiveElementsClass: string;
  } | null>(null);

  useEffect(() => {
    try {
      const chart =
        birthdayType === "lunar"
          ? astro.byLunar(birthday, birthTime, gender, false, true, "zh-TW")
          : astro.bySolar(birthday, birthTime, gender, true, "zh-TW");

      setChartData({
        palaces: chart.palaces.map((p) => ({
          name: p.name,
          heavenlyStem: p.heavenlyStem,
          earthlyBranch: p.earthlyBranch,
          isBodyPalace: p.isBodyPalace,
          isOriginalPalace: p.isOriginalPalace,
          majorStars: (p.majorStars || [])
            .filter((s: { name: string }) => s.name)
            .map((s: { name: string; brightness?: string; mutagen?: string }) => ({
              name: s.name,
              brightness: s.brightness,
              mutagen: s.mutagen,
            })),
          minorStars: (p.minorStars || [])
            .filter((s: { name: string }) => s.name)
            .map((s: { name: string; mutagen?: string }) => ({
              name: s.name,
              mutagen: s.mutagen,
            })),
          decadal: p.decadal?.range ? { range: p.decadal.range } : undefined,
        })),
        solarDate: chart.solarDate,
        lunarDate: chart.lunarDate,
        zodiac: chart.zodiac,
        soul: chart.soul,
        body: chart.body,
        fiveElementsClass: chart.fiveElementsClass,
      });
    } catch (e) {
      console.error("[ZiweiChart] chart generation error:", e);
    }
  }, [birthday, birthTime, gender, birthdayType]);

  // Build 4x4 grid: palaces around the edges, center 2x2 for info
  const grid = useMemo(() => {
    if (!chartData) return null;

    const cells: (
      | { type: "palace"; palace: PalaceData; isActive: boolean }
      | { type: "center" }
      | null
    )[][] = Array.from({ length: 4 }, () => Array(4).fill(null));

    for (let i = 0; i < chartData.palaces.length; i++) {
      const [row, col] = GRID_MAP[i];
      const palace = chartData.palaces[i];
      cells[row][col] = {
        type: "palace",
        palace,
        isActive: palace.isOriginalPalace,
      };
    }

    // Center cells
    cells[1][1] = { type: "center" };
    cells[1][2] = null; // spanned by center
    cells[2][1] = null; // spanned by center
    cells[2][2] = null; // spanned by center

    return cells;
  }, [chartData]);

  if (!chartData || !grid) {
    return (
      <div className="my-4 rounded-lg border border-border-light p-6 text-center text-sm text-text-tertiary/40">
        命盤計算中...
      </div>
    );
  }

  return (
    <div className="my-4 rounded-lg border border-border-light overflow-x-auto">
      <div className="grid grid-cols-4 grid-rows-4 min-w-[480px]">
        {grid.flatMap((row, r) =>
          row.map((cell, c) => {
            if (!cell) return null;
            if (cell.type === "center") {
              return (
                <CenterCell
                  key={`${r}-${c}`}
                  solarDate={chartData.solarDate}
                  lunarDate={chartData.lunarDate}
                  gender={gender}
                  fiveElements={chartData.fiveElementsClass}
                  soul={chartData.soul}
                  body={chartData.body}
                  zodiac={chartData.zodiac}
                />
              );
            }
            return (
              <PalaceCell
                key={`${r}-${c}`}
                palace={cell.palace}
                isActive={cell.isActive}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

export default function ZiweiChart(props: ZiweiChartProps) {
  return (
    <ZiweiChartErrorBoundary>
      <ZiweiChartInner {...props} />
    </ZiweiChartErrorBoundary>
  );
}
