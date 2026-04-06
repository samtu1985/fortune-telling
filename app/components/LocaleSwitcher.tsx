"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale } from "./LocaleProvider";
import { LOCALE_OPTIONS } from "@/app/lib/i18n";

export default function LocaleSwitcher() {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label={t("locale.switch")}
        className="p-2 rounded-sm text-stone hover:text-gold transition-colors duration-300"
      >
        {/* Globe icon */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-[140px] rounded border border-gold/20 shadow-lg z-[100]" style={{ background: "var(--parchment-light)" }}>
          {LOCALE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setLocale(opt.value);
                setOpen(false);
              }}
              className={`
                block w-full px-4 py-2 text-left text-sm transition-colors
                ${opt.value === locale
                  ? "text-gold bg-gold/10"
                  : "text-stone hover:text-gold hover:bg-gold/5"
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
