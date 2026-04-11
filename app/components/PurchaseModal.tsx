"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useLocale } from "./LocaleProvider";

// Allow the Stripe Buy Button custom element in JSX (React 19 uses React.JSX).
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "stripe-buy-button": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          "buy-button-id": string;
          "publishable-key": string;
          "client-reference-id"?: string;
        },
        HTMLElement
      >;
    }
  }
}

type Pkg = {
  id: number;
  name: string;
  description: string | null;
  buyButtonId: string;
  priceAmount: number | null;
  currency: string;
  singleCreditsGranted: number;
  multiCreditsGranted: number;
};

// Shared across all packages — read from Vercel env var at build time.
// Exposed to the client via NEXT_PUBLIC_ prefix.
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

interface PurchaseModalProps {
  userId: number;
  onClose: () => void;
}

function formatPrice(amount: number | null, currency: string): string {
  if (amount == null) return "";
  const symbol = currency?.toLowerCase() === "hkd" ? "HK$" : currency.toUpperCase() + " ";
  const value = amount / 100;
  const hasCents = amount % 100 !== 0;
  return `${symbol} ${hasCents ? value.toFixed(2) : value.toFixed(0)}`;
}

export default function PurchaseModal({ userId, onClose }: PurchaseModalProps) {
  const { t } = useLocale();
  const [packages, setPackages] = useState<Pkg[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/packages", { cache: "no-store" });
        if (!res.ok) throw new Error("request failed");
        const data = await res.json();
        if (cancelled) return;
        // Accept either { packages: [...] } or a bare array
        const list: Pkg[] = Array.isArray(data) ? data : data.packages ?? [];
        setPackages(list);
      } catch {
        if (!cancelled) setError(t("purchase.loadError"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function onBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <>
      <Script
        src="https://js.stripe.com/v3/buy-button.js"
        strategy="afterInteractive"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-modal-title"
        onMouseDown={onBackdropClick}
        className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/70 backdrop-blur-sm px-4 py-8 sm:py-12"
      >
        <div
          ref={dialogRef}
          className="glass-card-premium relative w-full max-w-3xl animate-fade-in-up"
          style={{
            opacity: 0,
            background: "var(--parchment)",
            boxShadow:
              "0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(212,173,74,0.18)",
          }}
        >
          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            aria-label={t("purchase.closeAria")}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-gold/25 text-gold/80 transition-colors hover:border-gold/60 hover:text-gold"
            style={{ background: "rgba(0,0,0,0.12)" }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 3L13 13M13 3L3 13"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
              />
            </svg>
          </button>

          {/* Header */}
          <div className="px-6 pt-12 pb-6 sm:px-12 sm:pt-14 sm:pb-8 text-center">
            <div
              className="mx-auto mb-5 text-[10px] sm:text-xs tracking-[0.3em] sm:tracking-[0.4em] text-gold/70"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {t("purchase.header")}
            </div>
            <h2
              id="purchase-modal-title"
              className="text-xl sm:text-3xl font-medium tracking-[0.08em] sm:tracking-[0.12em] text-gold break-words"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {t("purchase.title")}
            </h2>
            <div className="gold-line mx-auto mt-5 w-24" />
            <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-mist">
              {t("purchase.subtitle")}
            </p>
          </div>

          {/* Body */}
          <div className="px-5 pb-10 sm:px-10 sm:pb-14">
            {error ? (
              <div className="py-10 text-center text-sm text-red-seal">
                {error}
              </div>
            ) : packages === null ? (
              <LoadingState t={t} />
            ) : packages.length === 0 ? (
              <EmptyState t={t} />
            ) : (
              <div className="grid gap-6 sm:gap-7">
                {packages.map((pkg, i) => (
                  <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    userId={userId}
                    index={i}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="border-t border-gold/10 px-5 py-5 sm:px-12 text-center">
            <p className="text-[10px] sm:text-[11px] tracking-[0.1em] sm:tracking-[0.15em] text-stone/70 leading-relaxed">
              {t("purchase.footer")}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

type TFn = (key: string, params?: Record<string, string>) => string;

function PackageCard({
  pkg,
  userId,
  index,
  t,
}: {
  pkg: Pkg;
  userId: number;
  index: number;
  t: TFn;
}) {
  const price = formatPrice(pkg.priceAmount, pkg.currency);

  return (
    <div
      className="group relative overflow-hidden rounded-lg border border-gold/20 transition-all duration-500 hover:border-gold/45 animate-fade-in-up"
      style={{
        background:
          "linear-gradient(180deg, rgba(212,173,74,0.04) 0%, rgba(212,173,74,0.01) 100%)",
        boxShadow: "inset 0 1px 0 rgba(212,173,74,0.12)",
        opacity: 0,
        animationDelay: `${120 + index * 90}ms`,
      }}
    >
      {/* Decorative top rule */}
      <div
        className="absolute left-0 right-0 top-0 h-[2px] opacity-60"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--gold), transparent)",
        }}
      />

      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-stretch sm:gap-8 sm:p-8">
        {/* Left: details */}
        <div className="flex-1 min-w-0">
          <h3
            className="text-xl sm:text-[1.4rem] font-medium tracking-[0.1em] text-gold"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {pkg.name}
          </h3>

          {pkg.description && (
            <p className="mt-2 text-sm leading-relaxed text-mist">
              {pkg.description}
            </p>
          )}

          {/* Price */}
          {price && (
            <div className="mt-5 flex items-baseline gap-2">
              <span
                className="text-3xl sm:text-4xl font-medium text-cream"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {price}
              </span>
            </div>
          )}

          {/* Credit grants */}
          <ul className="mt-5 space-y-2">
            {pkg.singleCreditsGranted > 0 && (
              <li className="flex items-center gap-3 text-sm text-cream/90">
                <CreditBullet />
                <span>
                  {t("purchase.includesSingle", {
                    n: String(pkg.singleCreditsGranted),
                  })}
                </span>
              </li>
            )}
            {pkg.multiCreditsGranted > 0 && (
              <li className="flex items-center gap-3 text-sm text-cream/90">
                <CreditBullet />
                <span>
                  {t("purchase.includesMulti", {
                    n: String(pkg.multiCreditsGranted),
                  })}
                </span>
              </li>
            )}
          </ul>
        </div>

        {/* Vertical divider (desktop) */}
        <div
          className="hidden sm:block w-px self-stretch"
          style={{
            background:
              "linear-gradient(180deg, transparent, rgba(212,173,74,0.25), transparent)",
          }}
        />

        {/* Right: Stripe Buy Button */}
        <div className="flex sm:w-[260px] flex-col items-center justify-center">
          <div className="w-full flex justify-center">
            <stripe-buy-button
              buy-button-id={pkg.buyButtonId}
              publishable-key={PUBLISHABLE_KEY}
              client-reference-id={String(userId)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function CreditBullet() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-[6px] w-[6px] rotate-45 bg-gold/70"
      style={{ boxShadow: "0 0 6px rgba(212,173,74,0.4)" }}
    />
  );
}

function LoadingState({ t }: { t: TFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div
        className="h-10 w-10 animate-[spin_2.2s_linear_infinite] rounded-full border border-gold/20"
        style={{
          borderTopColor: "var(--gold)",
          borderRightColor: "var(--gold)",
        }}
      />
      <p className="mt-5 text-xs tracking-[0.3em] text-stone/70">
        {t("purchase.loading")}
      </p>
    </div>
  );
}

function EmptyState({ t }: { t: TFn }) {
  return (
    <div className="py-14 text-center">
      <div className="gold-line mx-auto mb-6 w-16" />
      <p
        className="text-base text-cream/85"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {t("purchase.noPackages")}
      </p>
      <p className="mt-3 text-xs tracking-[0.15em] text-stone/70">
        {t("purchase.noPackagesHint")}
      </p>
    </div>
  );
}
