"use client";

import { useTheme } from "./ThemeProvider";

export default function SmokeParticles() {
  const { theme } = useTheme();
  const rgb = theme === "light" ? "139,112,40" : "196,163,90";

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-smoke"
          style={{
            width: `${60 + i * 40}px`,
            height: `${60 + i * 40}px`,
            left: `${15 + i * 18}%`,
            top: `${20 + (i % 3) * 25}%`,
            background: `radial-gradient(circle, rgba(${rgb},${0.04 - i * 0.005}) 0%, transparent 70%)`,
            animationDelay: `${i * 1.6}s`,
            animationDuration: `${8 + i * 2}s`,
          }}
        />
      ))}
    </div>
  );
}
