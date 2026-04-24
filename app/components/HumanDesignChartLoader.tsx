"use client";

import { useEffect, useState } from "react";
import HumanDesignChart from "@/app/components/HumanDesignChart";
import type { HumanDesignChartData } from "@/app/lib/humandesign/types";
import { useLocale } from "@/app/components/LocaleProvider";

interface BirthInfo {
  birthDate: string;       // "YYYY-MM-DD"
  birthTime: string;       // "HH:mm"
  birthPlace: string;
  calendarType?: "solar" | "lunar";
  isLunar?: boolean;
  isLeapMonth?: boolean;
}

export default function HumanDesignChartLoader({ birthInfo }: { birthInfo: BirthInfo }) {
  const { t } = useLocale();
  const [chart, setChart] = useState<HumanDesignChartData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/chart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "humandesign",
            birthDate: birthInfo.birthDate,
            birthTime: birthInfo.birthTime,
            birthPlace: birthInfo.birthPlace,
            isLunar:
              birthInfo.isLunar ??
              (birthInfo.calendarType === "lunar"),
            isLeapMonth: birthInfo.isLeapMonth ?? false,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const code = typeof body.error === "string" ? body.error : "humandesign_unknown";
          const localized =
            code === "humandesign_not_configured" ? t("humandesign.error.notConfigured") :
            code === "humandesign_auth" ? t("humandesign.error.authFailed") :
            code === "humandesign_invalid_input" ? t("humandesign.error.invalidInput") :
            t("humandesign.error.serviceUnavailable");
          if (!cancelled) setError(localized);
          return;
        }
        const data = await res.json();
        if (!cancelled) setChart(data.chart ?? null);
      } catch {
        if (!cancelled) setError(t("humandesign.error.serviceUnavailable"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [
    birthInfo.birthDate,
    birthInfo.birthTime,
    birthInfo.birthPlace,
    birthInfo.calendarType,
    birthInfo.isLunar,
    birthInfo.isLeapMonth,
    t,
  ]);

  if (loading) {
    return (
      <div className="w-full max-w-[640px] mx-auto text-center py-8 text-sm text-text-tertiary">
        {t("chart.loading")}
      </div>
    );
  }
  if (error) {
    return (
      <div className="w-full max-w-[640px] mx-auto text-center py-8 text-sm text-red-500">
        {error}
      </div>
    );
  }
  if (!chart) return null;
  return <HumanDesignChart chart={chart} />;
}
