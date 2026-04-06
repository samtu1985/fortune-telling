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
    <button
      onClick={onClick}
      className="animate-fade-in-up group relative text-left w-full h-full"
      style={{ animationDelay: `${delay}ms`, opacity: 0 }}
    >
      <div
        className={`
          relative overflow-hidden h-full glass-card
          ${active ? "!border-gold/60 !bg-gold/[0.08] !shadow-[0_0_30px_var(--card-shadow)]" : ""}
        `}
      >
        <div className="p-6 sm:p-8 flex flex-col h-full">
          {/* Symbol */}
          <div
            className={`text-4xl sm:text-5xl mb-4 transition-all duration-500 ${
              active ? "opacity-100" : "opacity-40 group-hover:opacity-70"
            }`}
          >
            {symbol}
          </div>

          {/* Title */}
          <h3
            className={`font-serif text-xl sm:text-2xl font-semibold tracking-wide mb-1 transition-colors duration-300 ${
              active ? "text-gold" : "text-cream group-hover:text-gold-bright"
            }`}
          >
            {title}
          </h3>

          {/* Subtitle */}
          <p className="font-display text-sm text-stone italic mb-3">
            {subtitle}
          </p>

          {/* Description */}
          <p className="text-sm text-mist/70 leading-relaxed flex-1">{description}</p>

          {/* CTA */}
          <p className={`mt-4 text-sm font-serif tracking-wide transition-colors duration-300 ${
            active ? "text-gold" : "text-gold-dim/60 group-hover:text-gold"
          }`}>
            {t("type.cta")} →
          </p>
        </div>

        {/* Active indicator seal */}
        {active && (
          <div className="absolute top-4 right-4 seal-appear">
            <div className="w-8 h-8 rounded-full border-2 border-red-seal/60 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-red-seal/80" />
            </div>
          </div>
        )}
      </div>
    </button>
  );
}
