"use client";

import { useEffect, useState } from "react";
import { useLocale } from "./LocaleProvider";
import FeaturesGuideModal from "./FeaturesGuideModal";

// Bump this when new features are added to the guide — any user whose stored
// "seen" value doesn't match the current version will see the blinking icon
// again, drawing their attention back to the updated content.
export const FEATURES_GUIDE_VERSION = "1";
const STORAGE_KEY = "features-guide-seen-v";

export default function FeaturesGuideButton() {
  const { t } = useLocale();
  // Initial render matches server output (no blink) to avoid hydration flash.
  const [unseen, setUnseen] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (seen !== FEATURES_GUIDE_VERSION) setUnseen(true);
    } catch {
      // Safari private mode / disabled storage — silently treat as seen.
    }
  }, []);

  function handleOpen() {
    setOpen(true);
    setUnseen(false); // stop blink immediately when user clicks
  }

  function handleClose() {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, FEATURES_GUIDE_VERSION);
    } catch {
      // ignore
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={t("guide.iconAria")}
        title={t("guide.iconAria")}
        className={`relative p-2 rounded-sm text-stone hover:text-gold transition-colors duration-300 ${
          unseen ? "features-guide-blink" : ""
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 5.5c-1.5-1-4-1.5-6.5-1.5H4v14h1.5c2.5 0 5 .5 6.5 1.5" />
          <path d="M12 5.5c1.5-1 4-1.5 6.5-1.5H20v14h-1.5c-2.5 0-5 .5-6.5 1.5" />
          <path d="M12 5.5v14" />
          <path d="M7 9h3M7 12h3M14 9h3M14 12h3" strokeWidth="1.2" opacity="0.6" />
        </svg>
        {unseen && (
          <span
            className="features-guide-dot absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-gold pointer-events-none"
            aria-hidden="true"
          />
        )}
      </button>
      <FeaturesGuideModal open={open} onClose={handleClose} />
    </>
  );
}
