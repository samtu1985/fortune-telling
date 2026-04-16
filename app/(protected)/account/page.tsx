"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import PurchaseHistory from "@/app/components/account/PurchaseHistory";
import { useLocale } from "@/app/components/LocaleProvider";

export default function AccountPage() {
  const router = useRouter();
  const { t } = useLocale();

  function handleBack() {
    // Prefer browser history if available, fall back to home.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-accent transition-colors min-h-[44px]"
          aria-label={t("account.back")}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          {t("account.back")}
        </button>
        <Link
          href="/"
          className="text-xs text-text-secondary hover:text-accent transition-colors min-h-[44px] flex items-center"
        >
          {t("account.home")}
        </Link>
      </div>
      <h1 className="text-2xl sm:text-3xl text-accent mb-8">
        {t("account.title")}
      </h1>
      <PurchaseHistory />
    </div>
  );
}
