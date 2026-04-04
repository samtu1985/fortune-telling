"use client";

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
  return (
    <button
      onClick={onClick}
      className="animate-fade-in-up group relative text-left w-full h-full"
      style={{ animationDelay: `${delay}ms`, opacity: 0 }}
    >
      <div
        className={`
          relative overflow-hidden rounded-sm border transition-all duration-500 h-full
          ${
            active
              ? "border-gold/60 bg-gold/[0.06]"
              : "border-gold/10 hover:border-gold/30"
          }
        `}
        style={{
          backgroundColor: active ? undefined : `rgba(var(--glass-rgb), 0.02)`,
          boxShadow: active ? `0 0 30px var(--card-shadow)` : undefined,
        }}
      >
        {/* Top gold accent line */}
        <div
          className={`h-[2px] transition-all duration-500 ${
            active
              ? "bg-gradient-to-r from-transparent via-gold to-transparent"
              : "bg-gradient-to-r from-transparent via-gold-dim/30 to-transparent"
          }`}
        />

        <div className="p-6 sm:p-8">
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
          <p className="text-sm text-mist/70 leading-relaxed">{description}</p>
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
