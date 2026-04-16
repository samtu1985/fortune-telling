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
        className="tesla-card-bordered relative w-full max-w-md animate-fade-in text-center"
        style={{
          opacity: 0,
          background: "var(--bg-primary)",
        }}
      >
        <div className="px-6 py-10 sm:px-12 sm:py-14">
          <div
            className="mx-auto mb-5 text-[10px] sm:text-xs text-accent/70"
          >
            {t("thanks.header")}
          </div>
          <h2
            id="thanks-modal-title"
            className="text-xl sm:text-3xl font-medium text-accent break-words"
          >
            {t("thanks.title")}
          </h2>
          <div className="tesla-divider mx-auto mt-5 w-24" />
          <p className="mx-auto mt-6 max-w-sm text-sm leading-relaxed text-text-secondary">
            {t("thanks.body")}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-10 rounded border border-accent/40 px-8 sm:px-10 py-3 text-sm text-accent transition-colors hover:border-accent/70 hover:bg-accent/10 min-h-[44px]"
          >
            {t("thanks.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
