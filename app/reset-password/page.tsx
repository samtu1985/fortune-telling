"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import ThemeToggle from "@/app/components/ThemeToggle";
import SiteFooter from "@/app/components/SiteFooter";
import { useLocale } from "@/app/components/LocaleProvider";
import LocaleSwitcher from "@/app/components/LocaleSwitcher";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t("register.passwordMismatch"));
      return;
    }
    if (!PASSWORD_REGEX.test(password)) {
      setError(t("register.passwordWeakError"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(t("reset.invalidToken"));
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center min-h-screen px-6">
        <div className="text-center space-y-4">
          <p className="text-sm text-red-400">{t("reset.invalidToken")}</p>
          <a href="/login" className="text-sm text-accent hover:text-accent/80 transition-colors">
            {t("reset.backToLogin")}
          </a>
        </div>
        <SiteFooter variant="absolute" />
      </main>
    );
  }

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
          <p className="mt-2 text-sm text-text-tertiary">{t("reset.title")}</p>
          <div className="mx-auto mt-4 w-24 tesla-divider" />
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-text-secondary leading-relaxed">{t("reset.success")}</p>
            <a href="/login" className="inline-block text-sm text-accent hover:text-accent/80 transition-colors">
              {t("reset.backToLogin")}
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-text-tertiary mb-1 block">{t("reset.newPassword")}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("register.passwordPlaceholder")}
                className="w-full"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="text-xs text-text-tertiary mb-1 block">{t("reset.confirmPassword")}</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("register.confirmPasswordPlaceholder")}
                className="w-full"
                autoComplete="new-password"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-400 mt-1">{t("register.passwordMismatch")}</p>
              )}
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 min-h-[44px] bg-accent text-white rounded hover:bg-accent/90 transition-all duration-[330ms] disabled:opacity-40"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              ) : (
                t("reset.submit")
              )}
            </button>
            <p className="text-center">
              <a href="/login" className="text-xs text-text-tertiary hover:text-accent transition-colors">
                {t("reset.backToLogin")}
              </a>
            </p>
          </form>
        )}
      </div>

      <SiteFooter variant="absolute" />
    </main>
  );
}
