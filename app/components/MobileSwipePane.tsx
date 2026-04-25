"use client";

import { useEffect, useRef, useState } from "react";

interface Panel {
  key: string;
  hintWhenInactive: string;
  content: React.ReactNode;
}

interface Props {
  panels: Panel[];
  initialPanel?: number;
  triggerHint?: boolean;
  hintSessionKey?: string;
}

function useMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export default function MobileSwipePane({
  panels,
  initialPanel = 0,
  triggerHint = false,
  hintSessionKey,
}: Props) {
  const isMobile = useMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(initialPanel);
  const [hintShown, setHintShown] = useState(false);

  // Defeat iOS edge-swipe back/forward while mounted
  useEffect(() => {
    if (!isMobile) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overscrollBehaviorX;
    const prevBody = body.style.overscrollBehaviorX;
    html.style.overscrollBehaviorX = "none";
    body.style.overscrollBehaviorX = "none";
    return () => {
      html.style.overscrollBehaviorX = prevHtml;
      body.style.overscrollBehaviorX = prevBody;
    };
  }, [isMobile]);

  // Initial scroll to initialPanel
  useEffect(() => {
    if (!isMobile) return;
    const el = containerRef.current;
    if (!el || initialPanel === 0) return;
    const w = el.clientWidth;
    el.scrollTo({ left: w * initialPanel });
    setCurrentIndex(initialPanel);
  }, [initialPanel, isMobile]);

  // Hint: show once per session
  useEffect(() => {
    if (!isMobile || !triggerHint || hintShown) return;
    if (hintSessionKey && typeof window !== "undefined") {
      try {
        if (window.sessionStorage.getItem(hintSessionKey)) return;
      } catch {
        /* ignore */
      }
    }
    setHintShown(true);
    if (hintSessionKey) {
      try {
        window.sessionStorage.setItem(hintSessionKey, "1");
      } catch {
        /* ignore */
      }
    }
    const t = setTimeout(() => setHintShown(false), 4500);
    return () => clearTimeout(t);
  }, [triggerHint, hintShown, hintSessionKey, isMobile]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w <= 0) return;
    const idx = Math.round(el.scrollLeft / w);
    setCurrentIndex(Math.max(0, Math.min(panels.length - 1, idx)));
  }

  // Desktop: stack panels normally, no swipe
  if (!isMobile) {
    return (
      <>
        {panels.map((p) => (
          <div key={p.key}>{p.content}</div>
        ))}
      </>
    );
  }

  const inactiveHint =
    panels[currentIndex === 0 ? 1 : 0]?.hintWhenInactive ?? "";

  return (
    <>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 flex overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden px-1"
        style={{
          scrollbarWidth: "none",
          touchAction: "pan-x pan-y",
          overscrollBehaviorX: "contain",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {panels.map((p) => (
          <section
            key={p.key}
            className="flex-none w-full snap-start min-h-0"
            style={{ scrollSnapStop: "always" }}
          >
            {p.content}
          </section>
        ))}
      </div>

      {hintShown && (
        <div
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-accent text-white text-sm font-medium rounded-full shadow-lg pointer-events-none"
          style={{ animation: "swipe-hint-pop 4.5s ease-out forwards" }}
        >
          {inactiveHint}
        </div>
      )}

      {panels.length > 1 && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 flex gap-1.5 pointer-events-none">
          {panels.map((p, i) => (
            <span
              key={p.key}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                currentIndex === i ? "bg-accent" : "bg-text-tertiary/40"
              }`}
            />
          ))}
        </div>
      )}

      <style jsx global>{`
        @keyframes swipe-hint-pop {
          0% {
            opacity: 0;
            transform: translate(-50%, -8px);
          }
          12% {
            opacity: 1;
            transform: translate(-50%, 0);
          }
          18% {
            transform: translate(-50%, -2px);
          }
          24% {
            transform: translate(-50%, 0);
          }
          85% {
            opacity: 1;
            transform: translate(-50%, 0);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -4px);
          }
        }
      `}</style>
    </>
  );
}
