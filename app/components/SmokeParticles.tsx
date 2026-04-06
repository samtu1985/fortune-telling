"use client";

import { useTheme } from "./ThemeProvider";
import { useMemo } from "react";

export default function SmokeParticles() {
  const { theme } = useTheme();
  const isDark = theme !== "light";

  // Generate deterministic star positions
  const stars = useMemo(() => {
    const result = [];
    // Use a simple seed-based pseudo-random for consistent positions
    let seed = 42;
    const rand = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 80; i++) {
      result.push({
        x: rand() * 100,
        y: rand() * 100,
        size: rand() * 1.5 + 0.5,
        opacity: rand() * 0.6 + 0.2,
        delay: rand() * 5,
        duration: rand() * 3 + 2,
        isGold: rand() > 0.85,
      });
    }
    return result;
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {/* Nebula glow orbs */}
      {isDark && (
        <>
          <div
            className="absolute rounded-full animate-smoke"
            style={{
              width: "500px",
              height: "500px",
              left: "10%",
              top: "15%",
              background: "radial-gradient(circle, rgba(74,48,128,0.08) 0%, transparent 70%)",
              animationDuration: "20s",
            }}
          />
          <div
            className="absolute rounded-full animate-smoke"
            style={{
              width: "400px",
              height: "400px",
              right: "5%",
              top: "10%",
              background: "radial-gradient(circle, rgba(42,64,128,0.06) 0%, transparent 70%)",
              animationDelay: "3s",
              animationDuration: "18s",
            }}
          />
          <div
            className="absolute rounded-full animate-smoke"
            style={{
              width: "350px",
              height: "350px",
              left: "40%",
              bottom: "5%",
              background: "radial-gradient(circle, rgba(58,32,96,0.05) 0%, transparent 70%)",
              animationDelay: "6s",
              animationDuration: "15s",
            }}
          />
        </>
      )}

      {/* Stars */}
      {isDark &&
        stars.map((star, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-twinkle"
            style={{
              width: `${star.size}px`,
              height: `${star.size}px`,
              left: `${star.x}%`,
              top: `${star.y}%`,
              backgroundColor: star.isGold
                ? `rgba(212, 173, 74, ${star.opacity})`
                : `rgba(255, 255, 255, ${star.opacity})`,
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.duration}s`,
            }}
          />
        ))}

      {/* Light mode: soft golden particles */}
      {!isDark && (
        <>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full animate-smoke"
              style={{
                width: `${60 + i * 40}px`,
                height: `${60 + i * 40}px`,
                left: `${15 + i * 18}%`,
                top: `${20 + (i % 3) * 25}%`,
                background: `radial-gradient(circle, rgba(139,112,40,${0.04 - i * 0.005}) 0%, transparent 70%)`,
                animationDelay: `${i * 1.6}s`,
                animationDuration: `${8 + i * 2}s`,
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}
