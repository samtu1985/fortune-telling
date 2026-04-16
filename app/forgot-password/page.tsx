"use client";

import { useState } from "react";
import ThemeToggle from "@/app/components/ThemeToggle";
import SiteFooter from "@/app/components/SiteFooter";
import { useLocale } from "@/app/components/LocaleProvider";
import LocaleSwitcher from "@/app/components/LocaleSwitcher";

export default function ForgotPasswordPage() {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      // Always show success to not reveal email existence
    }
    setLoading(false);
    setSent(true);
  };

  return (
    <main className="relative z-10 flex-1 flex flex-col items-center justify-center min-h-screen px-6">
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm space-y-6 animate-fade-in">
        <div className="text-center">
          <h1 className="text-[40px] font-medium text-text-primary">
            {t("app.title")}
          </h1>
          <p className="mt-2 text-sm text-text-tertiary">{t("forgot.title")}</p>
          <div className="mx-auto mt-4 w-24 tesla-divider" />
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-text-secondary leading-relaxed">{t("forgot.success")}</p>
            <a href="/login" className="inline-block text-sm text-accent hover:text-accent/80 transition-colors">
              {t("forgot.backToLogin")}
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-text-tertiary mb-1 block">{t("forgot.email")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full"
                autoComplete="email"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-3 min-h-[44px] bg-accent text-white rounded hover:bg-accent/90 transition-all duration-[330ms] disabled:opacity-40"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              ) : (
                t("forgot.submit")
              )}
            </button>
            <p className="text-center">
              <a href="/login" className="text-xs text-text-tertiary hover:text-accent transition-colors">
                {t("forgot.backToLogin")}
              </a>
            </p>
          </form>
        )}
      </div>

      <SiteFooter variant="absolute" />
    </main>
  );
}
