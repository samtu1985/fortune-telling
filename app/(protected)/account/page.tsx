"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import PurchaseHistory from "@/app/components/account/PurchaseHistory";

export default function AccountPage() {
  const router = useRouter();

  function handleBack() {
    // Prefer browser history if available, fall back to home.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm text-mist hover:text-gold transition-colors"
          aria-label="返回"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </button>
        <Link
          href="/"
          className="text-xs text-mist/60 hover:text-gold transition-colors"
        >
          回首頁
        </Link>
      </div>
      <h1 className="font-serif text-3xl text-gold mb-8">我的帳戶</h1>
      <PurchaseHistory />
    </div>
  );
}
