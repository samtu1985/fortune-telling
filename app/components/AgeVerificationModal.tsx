"use client";
import { useState } from "react";
import MinorWelcomeModal from "./MinorWelcomeModal";
import { useLocale } from "./LocaleProvider";

function computeAge(birthDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const birth = new Date(birthDate + "T00:00:00Z");
  const now = new Date();
  if (isNaN(birth.getTime()) || birth > now) return null;
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const m = now.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

export default function AgeVerificationModal() {
  const { t } = useLocale();
  const [birthDate, setBirthDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minorConfirmed, setMinorConfirmed] = useState(false);

  const age = computeAge(birthDate);
  const today = new Date().toISOString().slice(0, 10);

  async function submit() {
    if (!birthDate || age === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/me/verify-age", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthDate }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t("age.verifyFailed"));
        setSubmitting(false);
        return;
      }
      const data = await res.json();
      if (data.canPurchase === false) {
        setMinorConfirmed(true);
      } else {
        window.location.reload();
      }
    } catch {
      setError(t("age.networkError"));
      setSubmitting(false);
    }
  }

  if (minorConfirmed) {
    return <MinorWelcomeModal onDismiss={() => window.location.reload()} />;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-lg border border-border-light p-6 sm:p-8" style={{ background: "var(--bg-primary)" }}>
        <h2 className="mb-2 text-lg sm:text-xl font-semibold text-accent">
          {t("age.title")}
        </h2>
        <p className="mb-4 text-sm text-text-secondary leading-relaxed">
          {t("age.description")}
        </p>
        <div className="mb-5 flex gap-2.5 rounded border-l-2 border-accent/60 bg-bg-secondary p-3">
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-accent"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <p className="text-xs text-text-secondary leading-relaxed">
            {t("age.paymentNotice")}
          </p>
        </div>
        <label className="mb-2 block text-sm text-text-primary">
          {t("age.birthdayLabel")}
        </label>
        <input
          type="date"
          max={today}
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          className="w-full rounded border border-border-light px-3 py-2 text-base"
        />
        {age !== null && (
          <p className="mt-2 text-sm text-text-secondary">
            {t("age.youAreN", { n: String(age) })}
          </p>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          onClick={submit}
          disabled={!birthDate || age === null || submitting}
          className="mt-6 w-full rounded border border-accent/40 py-3 text-accent hover:bg-accent/10 transition-colors disabled:opacity-40 min-h-[44px]"
        >
          {submitting ? t("age.submitting") : t("age.confirm")}
        </button>
      </div>
    </div>
  );
}
