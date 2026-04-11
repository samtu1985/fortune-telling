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
      <div className="w-full max-w-md rounded-lg bg-white p-6 sm:p-8 shadow-2xl">
        <h2 className="mb-2 text-lg sm:text-xl font-semibold text-[#7a5c10]">
          {t("age.title")}
        </h2>
        <p className="mb-4 text-sm text-[#847b72] leading-relaxed">
          {t("age.description")}
        </p>
        <label className="mb-2 block text-sm text-[#1e1a14]">
          {t("age.birthdayLabel")}
        </label>
        <input
          type="date"
          max={today}
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          className="w-full rounded border border-[#c8bfa8] px-3 py-2 text-base"
        />
        {age !== null && (
          <p className="mt-2 text-sm text-[#847b72]">
            {t("age.youAreN", { n: String(age) })}
          </p>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          onClick={submit}
          disabled={!birthDate || age === null || submitting}
          className="mt-6 w-full rounded bg-[#7a5c10] py-3 text-white disabled:opacity-40 min-h-[44px]"
        >
          {submitting ? t("age.submitting") : t("age.confirm")}
        </button>
      </div>
    </div>
  );
}
