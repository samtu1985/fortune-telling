"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "./LocaleProvider";

interface FeaturesGuideModalProps {
  open: boolean;
  onClose: () => void;
}

type FeatureEntry = {
  titleKey: string;
  taglineKey: string;
  fullWidth?: boolean;
};

// Display order matters; i18n keys are intentionally not renumbered when new
// cards are inserted (renaming keys across 4 locales is high-churn for low gain).
// f8 is the most recently added card and is shown in position 03 by design.
const FEATURES: FeatureEntry[] = [
  { titleKey: "guide.f1.title", taglineKey: "guide.f1.tagline" }, // 密鎖天機
  { titleKey: "guide.f2.title", taglineKey: "guide.f2.tagline" }, // 眾師論道
  { titleKey: "guide.f8.title", taglineKey: "guide.f8.tagline" }, // 設計圖解讀 + 流年 (newest)
  { titleKey: "guide.f3.title", taglineKey: "guide.f3.tagline" }, // 紫微星盤視覺化
  { titleKey: "guide.f4.title", taglineKey: "guide.f4.tagline" }, // 命途隨聽 (Podcast)
  { titleKey: "guide.f5.title", taglineKey: "guide.f5.tagline" }, // 逐字流光應答
  { titleKey: "guide.f6.title", taglineKey: "guide.f6.tagline" }, // 四海同參
  { titleKey: "guide.f7.title", taglineKey: "guide.f7.tagline", fullWidth: true }, // 命盤永存
];

export default function FeaturesGuideModal({ open, onClose }: FeaturesGuideModalProps) {
  const { t } = useLocale();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Esc to close + body scroll lock while open
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="features-guide-title"
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 sm:p-6"
      onMouseDown={(e) => {
        // Click-outside-to-close: only when the initial press is on the backdrop itself
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-2xl rounded-xl border border-border-light animate-fade-in"
        style={{
          background: "var(--bg-primary)",
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label={t("guide.modal.close")}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border-light text-accent/80 transition-colors hover:border-accent/60 hover:text-accent"
          style={{ background: "rgba(0,0,0,0.12)" }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 3 L13 13 M13 3 L3 13"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* Header */}
        <div className="px-6 pt-10 pb-5 sm:px-10 sm:pt-12 sm:pb-6 text-center">
          <div
            className="mx-auto mb-3 text-[10px] sm:text-xs text-accent/60"
          >
            ✦ &nbsp; {t("guide.modal.cta")} &nbsp; ✦
          </div>
          <h2
            id="features-guide-title"
            className="text-xl sm:text-2xl font-medium text-accent break-words"
          >
            {t("guide.modal.title")}
          </h2>
          <div className="tesla-divider mx-auto mt-4 w-20" />
          <p
            className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-text-tertiary italic"
          >
            {t("guide.modal.intro")}
          </p>
        </div>

        {/* Feature grid */}
        <div className="px-5 pb-6 sm:px-10 sm:pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {FEATURES.map((f, i) => {
              const num = String(i + 1).padStart(2, "0");
              return (
                <div
                  key={f.titleKey}
                  className={`rounded-md border border-border-light bg-bg-secondary p-4 transition hover:border-accent/35 hover:bg-bg-secondary ${
                    f.fullWidth ? "sm:col-span-2" : ""
                  }`}
                >
                  <div
                    className="flex items-baseline gap-2 mb-1.5 text-accent"
                  >
                    <span className="text-[10px] text-accent/50">
                      {num}
                    </span>
                    <span className="text-base font-semibold">
                      {t(f.titleKey)}
                    </span>
                  </div>
                  <p className="text-xs sm:text-[13px] text-text-tertiary leading-relaxed">
                    {t(f.taglineKey)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Outro + CTA */}
        <div className="border-t border-border-light px-6 py-6 sm:px-10 sm:py-7 text-center">
          <p
            className="mb-4 text-sm italic text-text-tertiary"
          >
            {t("guide.modal.outro")}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-8 py-2.5 min-h-[44px] rounded-full border border-accent/50 text-accent text-sm hover:bg-accent/10 transition-colors"
          >
            {t("guide.modal.cta")}
          </button>
        </div>
      </div>
    </div>
  );
}
