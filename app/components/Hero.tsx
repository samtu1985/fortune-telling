"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { WavyBackground } from "./WavyBackground";

interface HeroProps {
  title: string;
  subtitle: string;
}

const PURPLE_GOLD = [
  "#4C1D95", // deep violet
  "#7C3AED", // royal purple
  "#A78BFA", // lavender
  "#D4AF37", // gold
  "#F4E4BC", // pale champagne
];

export default function Hero({ title, subtitle }: HeroProps) {
  return (
    <WavyBackground
      colors={PURPLE_GOLD}
      backgroundFill="transparent"
      blur={14}
      waveOpacity={0.35}
      waveWidth={42}
      speed="slow"
      className="relative overflow-hidden pt-16 pb-14 px-6 text-center"
    >
      {/* Soft radial vignette: keeps the corners darker for depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(15, 8, 36, 0.55) 100%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="mb-3 flex items-center gap-2 text-amber-200/80"
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-[11px] uppercase tracking-[0.32em]">天 機</span>
          <Sparkles className="w-4 h-4" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="text-[44px] sm:text-[52px] font-medium leading-tight"
          style={{
            background:
              "linear-gradient(135deg, #F4E4BC 0%, #D4AF37 35%, #A78BFA 65%, #7C3AED 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            textShadow: "0 0 40px rgba(167, 139, 250, 0.35)",
          }}
        >
          {title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-4 max-w-xl text-sm sm:text-base text-amber-100/70 leading-relaxed italic"
        >
          {subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-7 h-px w-32 origin-center"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, #D4AF37 50%, transparent 100%)",
          }}
        />
      </div>
    </WavyBackground>
  );
}
