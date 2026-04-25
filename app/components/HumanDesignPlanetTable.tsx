"use client";

import { useState } from "react";
import { useLocale } from "@/app/components/LocaleProvider";
import type {
  HumanDesignChartData,
  HumanDesignTransitData,
  Planet,
} from "@/app/lib/humandesign/types";

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

interface ColumnRow {
  planet: Planet;
  gate: number;
  line: number;
  highlight?: boolean;
}

function Column({
  title,
  rows,
  symbolColorClass,
}: {
  title: string;
  rows: ColumnRow[];
  symbolColorClass: string;
}) {
  return (
    <div className="rounded-sm border border-border-light bg-bg-secondary p-3">
      <div className="text-[10px] uppercase tracking-wider text-text-tertiary text-center mb-2">
        {title}
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => {
          if (!r.gate) return null;
          return (
            <div
              key={r.planet}
              className={`flex items-center justify-between gap-2 text-xs font-mono rounded px-1 ${
                r.highlight ? "bg-amber-400/15" : ""
              }`}
            >
              <span className={`text-base leading-none ${symbolColorClass}`}>
                {PLANET_SYMBOLS[r.planet]}
              </span>
              <span className="text-text-primary tabular-nums">
                {r.gate}.{r.line}
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
  const [showTransit, setShowTransit] = useState(false);
  const [transit, setTransit] = useState<HumanDesignTransitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleTransit() {
    if (showTransit) {
      setShowTransit(false);
      return;
    }
    if (transit) {
      setShowTransit(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/humandesign/transit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const code =
          typeof errBody.error === "string" ? errBody.error : "humandesign_unknown";
        const localized =
          code === "humandesign_not_configured"
            ? t("humandesign.error.notConfigured")
            : code === "humandesign_auth"
              ? t("humandesign.error.authFailed")
              : t("humandesign.error.serviceUnavailable");
        setError(localized);
        return;
      }
      const data = await res.json();
      setTransit(data.transit ?? null);
      setShowTransit(true);
    } catch {
      setError(t("humandesign.error.serviceUnavailable"));
    } finally {
      setLoading(false);
    }
  }

  // Pre-compute all natal-activated gates for fast highlight lookup.
  const natalGateSet = new Set<number>();
  for (const c of Object.values(chart.centers)) {
    for (const g of c.activatedGates) natalGateSet.add(g);
  }

  const showThree = showTransit && transit !== null;

  const designRows: ColumnRow[] = PLANET_ORDER.map((p) => {
    const a = chart.planets.design[p];
    return { planet: p, gate: a?.gate ?? 0, line: a?.line ?? 0 };
  });
  const personalityRows: ColumnRow[] = PLANET_ORDER.map((p) => {
    const a = chart.planets.personality[p];
    return { planet: p, gate: a?.gate ?? 0, line: a?.line ?? 0 };
  });
  const transitRows: ColumnRow[] = transit
    ? PLANET_ORDER.map((p) => {
        const a = transit.planets[p];
        const gate = a?.gate ?? 0;
        const line = a?.line ?? 0;
        // Highlight when transit's gate matches a natal-activated gate
        // (any planet on either side, or any activated center gate).
        const highlight = gate > 0 && natalGateSet.has(gate);
        return { planet: p, gate, line, highlight };
      })
    : [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={toggleTransit}
          disabled={loading}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            showTransit
              ? "border-amber-400 bg-amber-400/10 text-amber-400"
              : "border-border-light text-text-tertiary hover:border-amber-400 hover:text-amber-400"
          } disabled:opacity-50`}
        >
          {loading
            ? t("humandesign.transit.loading")
            : showTransit
              ? t("humandesign.transit.hide")
              : t("humandesign.transit.show")}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 text-center">{error}</p>}
      <div
        className={`grid gap-3 ${showThree ? "grid-cols-3" : "grid-cols-2"}`}
      >
        <Column
          title={t("humandesign.column.design")}
          rows={designRows}
          symbolColorClass="text-red-500/80"
        />
        <Column
          title={t("humandesign.column.personality")}
          rows={personalityRows}
          symbolColorClass="text-text-primary"
        />
        {showThree && (
          <Column
            title={t("humandesign.column.transit")}
            rows={transitRows}
            symbolColorClass="text-amber-400/90"
          />
        )}
      </div>
      {showThree && transit && (
        <p className="text-[10px] text-text-tertiary text-center">
          {t("humandesign.transit.timestamp")}:{" "}
          {new Date(transit.meta.fetchedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
