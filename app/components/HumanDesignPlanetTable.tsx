"use client";

import { useLocale } from "@/app/components/LocaleProvider";
import type { HumanDesignChartData, Planet } from "@/app/lib/humandesign/types";

const PLANET_SYMBOLS: Record<Planet, string> = {
  sun: "☉",
  earth: "⊕",
  moon: "☽",
  northNode: "☊",
  southNode: "☋",
  mercury: "☿",
  venus: "♀",
  mars: "♂",
  jupiter: "♃",
  saturn: "♄",
  uranus: "♅",
  neptune: "♆",
  pluto: "♇",
  chiron: "⚷",
};

// Standard Human Design display order: 13 luminaries + Chiron at the end.
const PLANET_ORDER: Planet[] = [
  "sun",
  "earth",
  "moon",
  "northNode",
  "southNode",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
  "chiron",
];

function PlanetColumn({
  title,
  side,
  chart,
  symbolColorClass,
}: {
  title: string;
  side: "design" | "personality";
  chart: HumanDesignChartData;
  symbolColorClass: string;
}) {
  return (
    <div className="rounded-sm border border-border-light bg-bg-secondary p-3">
      <div className="text-[10px] uppercase tracking-wider text-text-tertiary text-center mb-2">
        {title}
      </div>
      <div className="space-y-1.5">
        {PLANET_ORDER.map((p) => {
          const a = chart.planets[side][p];
          if (!a || !a.gate) return null;
          return (
            <div
              key={p}
              className="flex items-center justify-between gap-2 text-xs font-mono"
            >
              <span className={`text-base leading-none ${symbolColorClass}`}>
                {PLANET_SYMBOLS[p]}
              </span>
              <span className="text-text-primary tabular-nums">
                {a.gate}.{a.line}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HumanDesignPlanetTable({
  chart,
}: {
  chart: HumanDesignChartData;
}) {
  const { t } = useLocale();
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Design (unconscious / 先天) — red, by HD convention */}
      <PlanetColumn
        title={t("humandesign.column.design")}
        side="design"
        chart={chart}
        symbolColorClass="text-red-500/80"
      />
      {/* Personality (conscious / 後天) — black/primary */}
      <PlanetColumn
        title={t("humandesign.column.personality")}
        side="personality"
        chart={chart}
        symbolColorClass="text-text-primary"
      />
    </div>
  );
}
