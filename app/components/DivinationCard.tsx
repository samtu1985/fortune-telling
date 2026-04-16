"use client";

import { useLocale } from "./LocaleProvider";

interface DivinationCardProps {
  title: string;
  subtitle: string;
  symbol: string;
  description: string;
  active: boolean;
  onClick: () => void;
  delay: number;
}

export default function DivinationCard({
  title,
  subtitle,
  symbol,
  description,
  active,
  onClick,
  delay,
}: DivinationCardProps) {
  const { t } = useLocale();

  return (
    <button onClick={onClick} className="w-full h-full text-left">
      <div
        className={`
          h-full rounded p-6 sm:p-8 flex flex-col
          border transition-colors duration-[330ms]
          ${active
            ? "border-accent bg-accent/[0.04] border-l-[3px]"
            : "border-border-light hover:border-border-subtle bg-bg-primary"
          }
        `}
      >
        <div
          className={`text-4xl sm:text-5xl mb-4 transition-opacity duration-[330ms] ${
            active ? "opacity-100" : "opacity-30"
          }`}
        >
          {symbol}
        </div>

        <h3
          className={`text-[17px] font-medium mb-1 transition-colors duration-[330ms] ${
            active ? "text-accent" : "text-text-primary"
          }`}
        >
          {title}
        </h3>

        <p className="text-sm text-text-tertiary mb-3">{subtitle}</p>

        <p className="text-sm text-text-secondary leading-relaxed flex-1">
          {description}
        </p>

        <p
          className={`mt-4 text-sm font-medium transition-colors duration-[330ms] ${
            active ? "text-accent" : "text-text-tertiary"
          }`}
        >
          {t("type.cta")} →
        </p>
      </div>
    </button>
  );
}
