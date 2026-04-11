"use client";

import { useEffect } from "react";
import { useLocale } from "./LocaleProvider";

export default function ThanksForTryingModal({ onClose }: { onClose: () => void }) {
  const { t } = useLocale();
  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function onBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="thanks-modal-title"
      onMouseDown={onBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div
        className="glass-card-premium relative w-full max-w-md animate-fade-in-up text-center"
        style={{
          opacity: 0,
          background: "var(--parchment)",
          boxShadow:
            "0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(212,173,74,0.18)",
        }}
      >
        <div className="px-6 py-10 sm:px-12 sm:py-14">
          <div
            className="mx-auto mb-5 text-[10px] sm:text-xs tracking-[0.3em] sm:tracking-[0.4em] text-gold/70"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {t("thanks.header")}
          </div>
          <h2
            id="thanks-modal-title"
            className="text-xl sm:text-3xl font-medium tracking-[0.08em] sm:tracking-[0.12em] text-gold break-words"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {t("thanks.title")}
          </h2>
          <div className="gold-line mx-auto mt-5 w-24" />
          <p className="mx-auto mt-6 max-w-sm text-sm leading-relaxed text-mist">
            {t("thanks.body")}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-10 rounded border border-gold/40 px-8 sm:px-10 py-3 text-sm tracking-[0.15em] sm:tracking-[0.2em] text-gold transition-colors hover:border-gold/70 hover:bg-gold/10 min-h-[44px]"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {t("thanks.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
