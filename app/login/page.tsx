"use client";

import { signIn } from "next-auth/react";
import SmokeParticles from "@/app/components/SmokeParticles";
import ThemeToggle from "@/app/components/ThemeToggle";

export default function LoginPage() {
  return (
    <main className="relative z-10 flex-1 flex flex-col items-center justify-center min-h-screen px-6">
      <SmokeParticles />

      {/* Theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="text-center space-y-6 animate-fade-in-up" style={{ opacity: 0 }}>
        {/* Logo */}
        <h1 className="font-serif text-5xl sm:text-6xl font-bold tracking-[0.15em] text-gold">
          天命
        </h1>
        <p className="font-display text-lg text-stone italic tracking-wide">
          Divination by AI
        </p>

        <div className="mx-auto w-32 gold-line" />

        <p className="text-sm text-mist/60 tracking-wide">
          登入以開始命理推算
        </p>

        {/* Google Sign In */}
        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="
            mx-auto mt-4 px-8 py-3.5 min-h-[44px]
            border border-gold/30 rounded-sm
            text-gold hover:bg-gold/15
            transition-all duration-500
            font-serif tracking-widest
            flex items-center gap-3
          "
        >
          {/* Google icon */}
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          以 Google 帳號登入
        </button>
      </div>

      {/* Footer */}
      <div className="absolute bottom-8 text-center">
        <div className="mx-auto w-16 gold-line mb-4" />
        <p className="text-xs text-stone/40 tracking-widest font-display">
          Powered by Seed 2.0 Pro
        </p>
      </div>
    </main>
  );
}
