"use client";

import { signOut } from "next-auth/react";
import SmokeParticles from "./SmokeParticles";
import ThemeToggle from "./ThemeToggle";

interface PendingScreenProps {
  type: "pending" | "disabled";
}

export default function PendingScreen({ type }: PendingScreenProps) {
  const isPending = type === "pending";

  return (
    <main className="relative z-10 flex-1 flex flex-col items-center justify-center min-h-screen px-6">
      <SmokeParticles />

      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div
        className="text-center space-y-6 animate-fade-in-up"
        style={{ opacity: 0 }}
      >
        <h1 className="text-5xl sm:text-6xl font-bold tracking-[0.15em] text-gold" style={{ fontFamily: "var(--font-calligraphy)" }}>
          天機
        </h1>

        <div className="mx-auto w-32 gold-line" />

        <div className="space-y-3 max-w-sm mx-auto">
          <p className="text-lg text-cream font-serif">
            {isPending ? "帳號審核中" : "帳號已停用"}
          </p>
          <p className="text-sm text-stone/70 leading-relaxed">
            {isPending
              ? "您的帳號正在等待管理者審核，審核通過後即可開始使用命理推算服務。"
              : "您的帳號已被管理者停用，如有疑問請聯繫管理者。"}
          </p>
        </div>

        <div className="mx-auto w-16 gold-line" />

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mx-auto px-6 py-2.5 min-h-[44px] border border-gold/20 rounded-sm text-sm text-stone hover:text-gold hover:border-gold/40 transition-colors font-serif tracking-widest"
        >
          登出
        </button>
      </div>
    </main>
  );
}
