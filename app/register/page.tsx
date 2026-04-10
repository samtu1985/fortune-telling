"use client";

import { useState, useCallback } from "react";
import SmokeParticles from "@/app/components/SmokeParticles";
import ThemeToggle from "@/app/components/ThemeToggle";
import SiteFooter from "@/app/components/SiteFooter";
import { useLocale } from "@/app/components/LocaleProvider";
import LocaleSwitcher from "@/app/components/LocaleSwitcher";

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export default function RegisterPage() {
  const { t } = useLocale();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const checkUsername = useCallback(
    (() => {
      let timer: ReturnType<typeof setTimeout>;
      return (value: string) => {
        clearTimeout(timer);
        if (!value || !USERNAME_REGEX.test(value)) {
          setUsernameStatus("idle");
          return;
        }
        setUsernameStatus("checking");
        timer = setTimeout(async () => {
          try {
            const res = await fetch(`/api/auth/check-username?q=${encodeURIComponent(value)}`);
            const data = await res.json();
            setUsernameStatus(data.available ? "available" : "taken");
          } catch {
            setUsernameStatus("idle");
          }
        }, 500);
      };
    })(),
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!USERNAME_REGEX.test(username)) {
      setError(t("register.usernameInvalid"));
      return;
    }
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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "username_taken") setError(t("register.usernameTakenError"));
        else if (data.error === "email_taken") setError(t("register.emailTakenError"));
        else if (data.error === "password_weak") setError(t("register.passwordWeakError"));
        else setError(data.message || "Registration failed");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center min-h-screen px-6">
        <SmokeParticles />
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
        <div className="text-center space-y-6 max-w-sm animate-fade-in-up" style={{ opacity: 0 }}>
          <h1 className="text-3xl font-bold text-gold" style={{ fontFamily: "var(--font-calligraphy)" }}>
            {t("app.title")}
          </h1>
          <div className="mx-auto w-24 gold-line" />
          <p className="text-sm text-cream leading-relaxed">{t("register.success")}</p>
          <a href="/login" className="inline-block text-sm text-gold/70 hover:text-gold transition-colors">
            {t("register.backToLogin")}
          </a>
        </div>

        <SiteFooter variant="absolute" />
      </main>
    );
  }

  return (
    <main className="relative z-10 flex-1 flex flex-col items-center justify-center min-h-screen px-6">
      <SmokeParticles />
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm space-y-6 animate-fade-in-up" style={{ opacity: 0 }}>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gold" style={{ fontFamily: "var(--font-calligraphy)" }}>
            {t("app.title")}
          </h1>
          <p className="mt-2 text-sm text-stone">{t("register.title")}</p>
          <div className="mx-auto mt-4 w-24 gold-line" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-stone mb-1 block">{t("register.username")}</label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^a-zA-Z0-9_]/g, "");
                  setUsername(v);
                  checkUsername(v);
                }}
                placeholder={t("register.usernamePlaceholder")}
                className="w-full"
                maxLength={30}
                autoComplete="username"
              />
              {usernameStatus === "available" && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-500">{t("register.usernameAvailable")}</span>
              )}
              {usernameStatus === "taken" && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-400">{t("register.usernameTaken")}</span>
              )}
              {usernameStatus === "checking" && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border border-gold/30 border-t-gold rounded-full animate-spin" />
              )}
            </div>
          </div>

          <div>
            <label className="text-xs text-stone mb-1 block">{t("register.email")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("register.emailPlaceholder")}
              className="w-full"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-xs text-stone mb-1 block">{t("register.password")}</label>
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
            <label className="text-xs text-stone mb-1 block">{t("register.confirmPassword")}</label>
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
            disabled={loading || usernameStatus === "taken"}
            className="w-full py-3 min-h-[44px] border border-gold/30 rounded-sm text-gold hover:bg-gold/15 transition-all duration-500 font-serif tracking-widest disabled:opacity-40"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
            ) : (
              t("register.submit")
            )}
          </button>
        </form>

        <p className="text-center">
          <a href="/login" className="text-xs text-stone/60 hover:text-gold transition-colors">
            {t("register.backToLogin")}
          </a>
        </p>
      </div>

      <SiteFooter variant="absolute" />
    </main>
  );
}
