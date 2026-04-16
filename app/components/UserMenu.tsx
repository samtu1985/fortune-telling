"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import ProfileModal from "./ProfileModal";
import SendTrialModal from "./SendTrialModal";
import { useLocale } from "./LocaleProvider";
import { useFontSize } from "./FontSizeProvider";
import { useQuotaExhausted } from "./QuotaExhaustedGate";

const ADMIN_EMAIL = "geektu@gmail.com";

export default function UserMenu() {
  const { data: session } = useSession();
  const { t } = useLocale();
  const { fontSize, toggleFontSize } = useFontSize();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [trialOpen, setTrialOpen] = useState(false);
  const [isAmbassador, setIsAmbassador] = useState(false);
  const [canPurchase, setCanPurchase] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);
  const [unlimited, setUnlimited] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [credits, setCredits] = useState<{ singleRemaining: number; multiRemaining: number; unlimited?: boolean } | null>(null);
  const { trigger: triggerPurchaseModal } = useQuotaExhausted();

  useEffect(() => {
    if (dropdownOpen) {
      fetch("/api/credits")
        .then((r) => r.json())
        .then((data) => {
          if (data.singleRemaining !== undefined) {
            setCredits({ singleRemaining: data.singleRemaining, multiRemaining: data.multiRemaining, unlimited: data.unlimited });
          }
          if (data.isAmbassador) {
            setIsAmbassador(true);
          }
          setUnlimited(Boolean(data.unlimited));
          setCanPurchase(Boolean(data.canPurchase));
          setAgeVerified(Boolean(data.ageVerified));
        })
        .catch(() => {});
    }
  }, [dropdownOpen, credits]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  if (!session?.user) return null;

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 min-h-[44px]"
        >
          {session.user.image ? (
            <Image
              src={session.user.image}
              alt=""
              width={28}
              height={28}
              className="rounded-full border border-border-light"
            />
          ) : (
            <div className="w-7 h-7 rounded-full border border-border-light bg-bg-secondary flex items-center justify-center text-xs text-accent">
              {session.user.name?.[0]}
            </div>
          )}
          <span className="text-xs text-text-tertiary hidden sm:inline max-w-[100px] truncate">
            {session.user.name}
          </span>
          {/* Chevron */}
          <svg
            className={`w-3 h-3 text-text-tertiary transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown */}
        {dropdownOpen && (
          <div
            className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border-light shadow-lg overflow-hidden z-50"
            style={{ background: "var(--bg-primary)" }}
          >
            <button
              onClick={() => {
                setDropdownOpen(false);
                setProfileOpen(true);
              }}
              className="w-full text-left px-4 py-3 min-h-[44px] text-sm text-text-primary hover:bg-bg-secondary transition-colors flex items-center gap-2.5"
            >
              <svg className="w-4 h-4 text-text-tertiary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {t("menu.manageProfiles")}
            </button>
            <div className="h-px" style={{ background: "var(--border-light)" }} />
            <a
              href="/account"
              onClick={() => setDropdownOpen(false)}
              className="w-full text-left px-4 py-3 min-h-[44px] text-sm text-text-primary hover:bg-bg-secondary transition-colors flex items-center gap-2.5"
            >
              <svg className="w-4 h-4 text-text-tertiary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              {t("menu.purchaseHistory")}
            </a>
            {/* Purchase more credits — only shown to non-exempt users who have
                passed the age gate and are allowed to purchase (i.e. not minors). */}
            {ageVerified && canPurchase && !unlimited && (
              <>
                <div className="h-px" style={{ background: "var(--border-light)" }} />
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    triggerPurchaseModal(true);
                  }}
                  className="w-full text-left px-4 py-3 min-h-[44px] text-sm text-accent hover:bg-accent/10 transition-colors flex items-center gap-2.5"
                >
                  <svg className="w-4 h-4 text-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v18m9-9H3" />
                  </svg>
                  {t("menu.topUp")}
                </button>
              </>
            )}
            <div className="h-px" style={{ background: "var(--border-light)" }} />
            <button
              onClick={() => {
                toggleFontSize();
                setDropdownOpen(false);
              }}
              className="w-full text-left px-4 py-3 min-h-[44px] text-sm text-text-primary hover:bg-bg-secondary transition-colors flex items-center gap-2.5"
            >
              <svg className="w-4 h-4 text-text-tertiary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7V5a2 2 0 012-2h4m4 0h4a2 2 0 012 2v2M7 21h10M12 3v18" />
              </svg>
              {fontSize === "normal" ? t("menu.fontLarge") : t("menu.fontNormal")}
            </button>

            {(session.user.email === ADMIN_EMAIL || isAmbassador) && (
              <>
                <div className="h-px" style={{ background: "var(--border-light)" }} />
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    setTrialOpen(true);
                  }}
                  className="w-full text-left px-4 py-3 min-h-[44px] text-sm text-text-primary hover:bg-bg-secondary transition-colors flex items-center gap-2.5"
                >
                  <svg className="w-4 h-4 text-text-tertiary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                  </svg>
                  {t("menu.sendTrial")}
                </button>
              </>
            )}
            {session.user.email === ADMIN_EMAIL && (
              <>
                <div className="h-px" style={{ background: "var(--border-light)" }} />
                <a
                  href="/admin"
                  onClick={() => setDropdownOpen(false)}
                  className="w-full text-left px-4 py-3 min-h-[44px] text-sm text-text-primary hover:bg-bg-secondary transition-colors flex items-center gap-2.5"
                >
                  <svg className="w-4 h-4 text-text-tertiary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {t("admin.title")}
                </a>
              </>
            )}
            {credits && (
              <>
                <div className="h-px" style={{ background: "var(--border-light)" }} />
                <div className="px-4 py-3 space-y-1">
                  <p className="text-[10px] text-text-placeholder uppercase tracking-wider">{t("credits.title")}</p>
                  <p className="text-xs text-text-secondary">
                    {credits.unlimited
                      ? t("credits.singleRemaining").replace("{n}", "∞")
                      : t("credits.singleRemaining").replace("{n}", String(Math.max(0, credits.singleRemaining)))}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {credits.unlimited
                      ? t("credits.multiRemaining").replace("{n}", "∞")
                      : t("credits.multiRemaining").replace("{n}", String(Math.max(0, credits.multiRemaining)))}
                  </p>
                </div>
              </>
            )}
            <div className="h-px" style={{ background: "var(--border-light)" }} />
            <button
              onClick={() => signOut()}
              className="w-full text-left px-4 py-3 min-h-[44px] text-sm text-text-tertiary hover:bg-bg-secondary transition-colors flex items-center gap-2.5"
            >
              <svg className="w-4 h-4 text-text-tertiary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {t("menu.logout")}
            </button>
          </div>
        )}
      </div>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <SendTrialModal open={trialOpen} onClose={() => setTrialOpen(false)} />
    </>
  );
}
