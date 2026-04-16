"use client";
import { useLocale } from "./LocaleProvider";

export default function MinorWelcomeModal({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useLocale();
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-lg border border-border-light p-6 sm:p-8 text-center" style={{ background: "var(--bg-primary)" }}>
        <div className="mb-4 text-4xl">🌱</div>
        <h2 className="mb-3 text-lg sm:text-xl font-semibold text-accent">
          {t("minor.title")}
        </h2>
        <p className="mb-6 text-sm leading-relaxed text-text-primary">
          {t("minor.body")}
        </p>
        <button
          onClick={onDismiss}
          className="w-full rounded border border-accent/40 py-3 text-accent hover:bg-accent/10 transition-colors min-h-[44px]"
        >
          {t("minor.startButton")}
        </button>
      </div>
    </div>
  );
}
