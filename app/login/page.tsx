"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import ThemeToggle from "@/app/components/ThemeToggle";
import SiteFooter from "@/app/components/SiteFooter";
import { useLocale } from "@/app/components/LocaleProvider";
import LocaleSwitcher from "@/app/components/LocaleSwitcher";

function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Line|FBAN|FBAV|Instagram|MicroMessenger|Twitter|Threads/i.test(ua);
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const [inApp, setInApp] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setInApp(isInAppBrowser());
    setCurrentUrl(window.location.href);
    if (searchParams.get("error")) setError(true);
  }, [searchParams]);

  const handleOpenExternal = () => {
    const ua = navigator.userAgent || "";
    if (/Line/i.test(ua)) {
      window.location.href = `https://line.me/R/browse?url=${encodeURIComponent(currentUrl)}`;
    } else {
      window.open(currentUrl, "_system");
    }
  };

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError(false);
    const result = await signIn("credentials", {
      username: username.trim(),
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError(true);
    } else {
      window.location.href = "/";
    }
  };

  return (
    <main className="relative z-10 flex-1 flex flex-col items-center justify-center min-h-screen px-6">
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>

      <div className="text-center space-y-6 animate-fade-in">
        <h1 className="text-[40px] font-medium text-text-primary">
          {t("app.title")}
        </h1>
        <p className="text-sm text-text-tertiary">
          {t("app.subtitle")}
        </p>

        <div className="mx-auto w-32 tesla-divider" />

        {inApp ? (
          <div className="mx-auto max-w-xs space-y-4 text-sm text-text-secondary">
            <p className="text-accent font-semibold">{t("login.openExternal")}</p>
            <p>{t("login.inAppWarning")}</p>
            <p className="text-text-tertiary text-xs leading-relaxed">{t("login.openExternalHint")}</p>
            <button onClick={handleOpenExternal} className="mx-auto px-8 py-3.5 min-h-[44px] border border-border-light rounded-sm text-text-primary hover:border-border-subtle transition-all duration-500">
              {t("login.openExternalBtn")}
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(currentUrl); alert(t("login.urlCopied")); }}
              className="mx-auto px-6 py-2.5 min-h-[44px] text-text-tertiary hover:text-accent transition-all duration-300 text-xs flex items-center gap-2"
            >
              📋 {t("login.copyUrl")}
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-xs space-y-4">
            <p className="text-sm text-text-tertiary">{t("login.hint")}</p>

            {/* Google Sign In */}
            <button
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="mx-auto px-8 py-3.5 min-h-[44px] border border-border-light rounded-sm text-text-secondary hover:border-border-subtle transition-all duration-500 flex items-center gap-3"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {t("login.google")}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border-light" />
              <span className="text-xs text-text-placeholder">{t("login.or")}</span>
              <div className="flex-1 h-px bg-border-light" />
            </div>

            {/* Credentials Login */}
            <form onSubmit={handleCredentialsLogin} className="space-y-3">
              <input
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(false); }}
                placeholder={t("login.username")}
                className="w-full"
                autoComplete="username"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(false); }}
                placeholder={t("login.password")}
                className="w-full"
                autoComplete="current-password"
              />
              {error && (
                <p className="text-xs text-red-400">{t("login.loginError")}</p>
              )}
              <button
                type="submit"
                disabled={loading || !username.trim() || !password}
                className="w-full py-3 min-h-[44px] bg-accent text-white rounded hover:bg-accent/90 transition-all duration-500 disabled:opacity-40"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                ) : (
                  t("login.loginBtn")
                )}
              </button>
            </form>

            <div className="flex justify-between text-xs">
              <a href="/forgot-password" className="text-text-tertiary hover:text-accent transition-colors">
                {t("login.forgotPassword")}
              </a>
              <a href="/register" className="text-accent hover:text-accent/80 transition-colors">
                {t("login.registerLink")}
              </a>
            </div>
          </div>
        )}
      </div>

      <SiteFooter variant="absolute" />
    </main>
  );
}
