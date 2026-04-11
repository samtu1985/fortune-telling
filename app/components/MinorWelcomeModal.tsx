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
      <div className="w-full max-w-md rounded-lg bg-white p-6 sm:p-8 shadow-2xl text-center">
        <div className="mb-4 text-4xl">🌱</div>
        <h2 className="mb-3 text-lg sm:text-xl font-semibold text-[#7a5c10]">
          {t("minor.title")}
        </h2>
        <p className="mb-6 text-sm leading-relaxed text-[#1e1a14]">
          {t("minor.body")}
        </p>
        <button
          onClick={onDismiss}
          className="w-full rounded bg-[#7a5c10] py-3 text-white min-h-[44px]"
        >
          {t("minor.startButton")}
        </button>
      </div>
    </div>
  );
}
