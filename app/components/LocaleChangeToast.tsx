"use client";

import { useEffect, useState } from "react";
import { useLocale } from "./LocaleProvider";

const HAS_AI_HISTORY_KEY = "fortune:hasAiHistory";

export default function LocaleChangeToast() {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onLocaleChanged() {
      if (sessionStorage.getItem(HAS_AI_HISTORY_KEY) !== "1") return;
      setVisible(true);
    }
    window.addEventListener("locale:changed", onLocaleChanged);
    return () => window.removeEventListener("locale:changed", onLocaleChanged);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(false), 6000);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] max-w-sm w-[calc(100%-2rem)] rounded-lg border border-border-light shadow-lg px-4 py-3"
      style={{ background: "var(--bg-secondary)" }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-text-primary">
            {t("locale.switchedHistory.title")}
          </div>
          <div className="mt-1 text-xs text-text-tertiary leading-relaxed">
            {t("locale.switchedHistory.desc")}
          </div>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="flex-shrink-0 text-xs text-accent hover:text-accent/80 transition-colors font-medium"
        >
          {t("locale.switchedHistory.dismiss")}
        </button>
      </div>
    </div>
  );
}
