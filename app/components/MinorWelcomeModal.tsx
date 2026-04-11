"use client";
export default function MinorWelcomeModal({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-2xl text-center">
        <div className="mb-4 text-4xl">🌱</div>
        <h2 className="mb-3 text-xl font-semibold text-[#7a5c10]">感謝您來體驗</h2>
        <p className="mb-6 text-sm leading-relaxed text-[#1e1a14]">
          您目前可以完整使用 10 次個別問答與 2 次三師論道。人生的路還很長，未來還有無限可能，不必執著於先天命運。
        </p>
        <button
          onClick={onDismiss}
          className="w-full rounded bg-[#7a5c10] py-3 text-white"
        >
          開始體驗
        </button>
      </div>
    </div>
  );
}
