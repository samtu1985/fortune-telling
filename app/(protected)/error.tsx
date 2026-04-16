"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-col items-center justify-center min-h-dvh px-6 text-center">
      <h2 className="text-xl font-medium text-text-primary mb-3">
        發生錯誤
      </h2>
      <p className="text-sm text-text-tertiary mb-6">
        頁面載入時出現問題，請重新嘗試。
      </p>
      <button
        onClick={reset}
        className="px-6 py-2.5 rounded text-sm bg-accent text-white hover:bg-accent/90 transition-colors duration-[330ms]"
      >
        重新載入
      </button>
    </main>
  );
}
