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

const FEATURES: FeatureEntry[] = [
  { titleKey: "guide.f1.title", taglineKey: "guide.f1.tagline" },
  { titleKey: "guide.f2.title", taglineKey: "guide.f2.tagline" },
  { titleKey: "guide.f3.title", taglineKey: "guide.f3.tagline" },
  { titleKey: "guide.f4.title", taglineKey: "guide.f4.tagline" },
  { titleKey: "guide.f5.title", taglineKey: "guide.f5.tagline" },
  { titleKey: "guide.f6.title", taglineKey: "guide.f6.tagline" },
  { titleKey: "guide.f7.title", taglineKey: "guide.f7.tagline", fullWidth: true },
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
        className="relative w-full max-w-2xl rounded-xl border border-gold/20 animate-fade-in-up"
        style={{
          background: "var(--parchment)",
          boxShadow:
            "0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(212,173,74,0.18)",
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label={t("guide.modal.close")}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-gold/25 text-gold/80 transition-colors hover:border-gold/60 hover:text-gold"
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
            className="mx-auto mb-3 text-[10px] sm:text-xs tracking-[0.3em] sm:tracking-[0.4em] text-gold/60"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            ✦ &nbsp; {t("guide.modal.cta")} &nbsp; ✦
          </div>
          <h2
            id="features-guide-title"
            className="text-xl sm:text-2xl font-medium tracking-[0.12em] sm:tracking-[0.16em] text-gold break-words"
            style={{ fontFamily: "var(--font-calligraphy, var(--font-serif))" }}
          >
            {t("guide.modal.title")}
          </h2>
          <div className="gold-line mx-auto mt-4 w-20" />
          <p
            className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-stone/80 italic"
            style={{ fontFamily: "var(--font-serif)" }}
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
                  className={`rounded-md border border-gold/15 bg-black/10 p-4 transition hover:border-gold/35 hover:bg-black/20 ${
                    f.fullWidth ? "sm:col-span-2" : ""
                  }`}
                >
                  <div
                    className="flex items-baseline gap-2 mb-1.5 text-gold"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    <span className="text-[10px] tracking-widest text-gold/50">
                      {num}
                    </span>
                    <span className="text-base font-semibold">
                      {t(f.titleKey)}
                    </span>
                  </div>
                  <p className="text-xs sm:text-[13px] text-stone/80 leading-relaxed">
                    {t(f.taglineKey)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Outro + CTA */}
        <div className="border-t border-gold/10 px-6 py-6 sm:px-10 sm:py-7 text-center">
          <p
            className="mb-4 text-sm italic text-stone/70"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {t("guide.modal.outro")}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-8 py-2.5 min-h-[44px] rounded-full border border-gold/50 text-gold text-sm tracking-[0.1em] hover:bg-gold/10 transition-colors"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {t("guide.modal.cta")}
          </button>
        </div>
      </div>
    </div>
  );
}
