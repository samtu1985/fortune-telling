"use client";

import { useEffect, useState } from "react";
import type { HumanDesignChartData } from "@/app/lib/humandesign/types";
import { useLocale } from "@/app/components/LocaleProvider";
import { localizeHdTerm } from "@/app/lib/humandesign/localize";
import HumanDesignPlanetTable from "@/app/components/HumanDesignPlanetTable";
import {
  computeBrowserCacheKey,
  getCachedEntry,
  setCachedEntry,
  arrayBufferToBase64,
  base64ToUint8Array,
} from "@/app/lib/humandesign/browser-cache";

interface BirthInfo {
  birthDate: string; // "YYYY-MM-DD"
  birthTime: string; // "HH:mm"
  birthPlace: string;
  calendarType?: "solar" | "lunar";
  isLunar?: boolean;
  isLeapMonth?: boolean;
}

export default function HumanDesignChartLoader({ birthInfo }: { birthInfo: BirthInfo }) {
  const { t, locale } = useLocale();
  const [chart, setChart] = useState<HumanDesignChartData | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let currentObjectUrl: string | null = null;

    function localizeError(code: string): string {
      if (code === "humandesign_not_configured") return t("humandesign.error.notConfigured");
      if (code === "humandesign_auth") return t("humandesign.error.authFailed");
      if (code === "humandesign_invalid_input") return t("humandesign.error.invalidInput");
      return t("humandesign.error.serviceUnavailable");
    }

    const isLunar = birthInfo.isLunar ?? (birthInfo.calendarType === "lunar");
    const payload = {
      birthDate: birthInfo.birthDate,
      birthTime: birthInfo.birthTime,
      birthPlace: birthInfo.birthPlace,
      isLunar,
      isLeapMonth: birthInfo.isLeapMonth ?? false,
    };

    async function load() {
      setLoading(true);
      setError(null);

      // 1) Browser cache hit → render instantly, skip both API round-trips.
      let cacheKey = "";
      try {
        cacheKey = await computeBrowserCacheKey(birthInfo);
        const cached = getCachedEntry(cacheKey);
        if (cached && !cancelled) {
          const bytes = base64ToUint8Array(cached.imageBase64);
          const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
          currentObjectUrl = URL.createObjectURL(blob);
          setChart(cached.chart);
          setImageUrl(currentObjectUrl);
          setLoading(false);
          return;
        }
      } catch {
        // Cache key compute or read failed — fall through to network fetch.
      }

      // 2) Cache miss → fetch from API (server itself has its own cache).
      try {
        const [chartRes, imageRes] = await Promise.all([
          fetch("/api/chart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "humandesign", ...payload }),
          }),
          fetch("/api/humandesign/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }),
        ]);

        if (!chartRes.ok) {
          const body = await chartRes.json().catch(() => ({}));
          const code = typeof body.error === "string" ? body.error : "humandesign_unknown";
          if (!cancelled) setError(localizeError(code));
          return;
        }
        const chartBody = await chartRes.json();
        if (!cancelled) setChart(chartBody.chart ?? null);

        if (!imageRes.ok) {
          const body = await imageRes.json().catch(() => ({}));
          const code = typeof body.error === "string" ? body.error : "humandesign_unknown";
          if (!cancelled) setError(localizeError(code));
          return;
        }
        const arrayBuf = await imageRes.arrayBuffer();
        const blob = new Blob([new Uint8Array(arrayBuf)], { type: "image/png" });
        currentObjectUrl = URL.createObjectURL(blob);
        if (!cancelled) setImageUrl(currentObjectUrl);

        // Write-through to browser cache (best-effort; quota errors handled inside).
        if (cacheKey && chartBody.chart) {
          try {
            setCachedEntry(cacheKey, {
              chart: chartBody.chart,
              imageBase64: arrayBufferToBase64(arrayBuf),
              timestamp: Date.now(),
            });
          } catch {
            // Storage failure is non-fatal — server cache still saves credits.
          }
        }
      } catch {
        if (!cancelled) setError(t("humandesign.error.serviceUnavailable"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
      if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    };
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
  if (!chart || !imageUrl) return null;

  const s = chart.summary;
  const summaryItems: Array<{ labelKey: string; value: string }> = [
    { labelKey: "humandesign.label.type",       value: localizeHdTerm(locale, "type", s.type) },
    { labelKey: "humandesign.label.strategy",   value: localizeHdTerm(locale, "strategy", s.strategy) },
    { labelKey: "humandesign.label.authority",  value: localizeHdTerm(locale, "authority", s.authority) },
    { labelKey: "humandesign.label.profile",    value: s.profile },
    { labelKey: "humandesign.label.definition", value: localizeHdTerm(locale, "definition", s.definition) },
    { labelKey: "humandesign.label.signature",  value: localizeHdTerm(locale, "signature", s.signature) },
    { labelKey: "humandesign.label.notSelf",    value: localizeHdTerm(locale, "notSelf", s.notSelfTheme) },
  ];

  return (
    <div className="w-full max-w-[640px] mx-auto space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-sm border border-border-light bg-bg-secondary">
        {summaryItems.map(({ labelKey, value }) => (
          <div key={labelKey} className="text-xs">
            <div className="text-text-tertiary uppercase tracking-wide">{t(labelKey)}</div>
            <div className="mt-0.5 text-sm font-medium text-text-primary">{value || "—"}</div>
          </div>
        ))}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Human Design Bodygraph"
        className="w-full h-auto rounded-sm"
      />
      <HumanDesignPlanetTable chart={chart} />
    </div>
  );
}
