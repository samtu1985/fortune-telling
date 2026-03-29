"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-col items-center justify-center min-h-dvh px-6 text-center">
      <h2 className="text-xl font-serif text-gold tracking-wide mb-3">
        發生錯誤
      </h2>
      <p className="text-sm text-stone/60 mb-6">
        頁面載入時出現問題，請重新嘗試。
      </p>
      <button
        onClick={reset}
        className="px-6 py-2.5 rounded-sm text-sm font-serif tracking-widest border border-gold/20 text-gold hover:bg-gold/15 transition-colors"
      >
        重新載入
      </button>
    </main>
  );
}
