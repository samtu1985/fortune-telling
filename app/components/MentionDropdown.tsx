"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "./LocaleProvider";

interface MentionProfile {
  id: string;
  label: string;
  hasChart: boolean;
}

interface MentionDropdownProps {
  profiles: MentionProfile[];
  query: string;
  onSelect: (label: string) => void;
  onClose: () => void;
}

export default function MentionDropdown({
  profiles,
  query,
  onSelect,
  onClose,
}: MentionDropdownProps) {
  const { t } = useLocale();
  const ref = useRef<HTMLDivElement>(null);

  // Filter profiles by query
  const filtered = profiles.filter((p) =>
    p.label.toLowerCase().includes(query.toLowerCase())
  );

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  if (filtered.length === 0) return null;

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 right-0 mb-1 max-h-48 overflow-y-auto rounded-lg border border-gold/20 shadow-lg z-30"
      style={{ background: "var(--parchment)" }}
    >
      <div className="py-1">
        <div className="px-3 py-1.5 text-[10px] text-stone/40 tracking-wide">
          {t("mention.selectProfile")}
        </div>
        {filtered.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.label)}
            className="w-full text-left px-3 py-2 min-h-[36px] text-sm hover:bg-gold/10 transition-colors flex items-center justify-between gap-2"
          >
            <span className={p.hasChart ? "text-gold" : "text-stone/40"}>
              @{p.label}
            </span>
            {p.hasChart ? (
              <span className="text-[10px] text-gold-dim/60">({t("mention.hasChart")})</span>
            ) : (
              <span className="text-[10px] text-stone/30">({t("mention.noChart")})</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
