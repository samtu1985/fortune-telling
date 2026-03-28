"use client";

import { useState, useCallback } from "react";
import DivinationCard from "@/app/components/DivinationCard";
import InputForm from "@/app/components/InputForm";
import ResultDisplay from "@/app/components/ResultDisplay";
import SmokeParticles from "@/app/components/SmokeParticles";
import ThemeToggle from "@/app/components/ThemeToggle";
import UserMenu from "@/app/components/UserMenu";

type DivinationType = "bazi" | "ziwei" | "zodiac";

const DIVINATION_TYPES = [
  {
    id: "bazi" as DivinationType,
    title: "八字命理",
    subtitle: "Four Pillars of Destiny",
    symbol: "乾",
    description:
      "以出生年月日時的天干地支，推算五行生剋、十神關係，洞察命運格局與人生走向。",
  },
  {
    id: "ziwei" as DivinationType,
    title: "紫微斗數",
    subtitle: "Purple Star Astrology",
    symbol: "紫",
    description:
      "依十四主星排列命盤十二宮位，解析先天命格、後天運勢，揭示人生各面向的起伏。",
  },
  {
    id: "zodiac" as DivinationType,
    title: "西洋星座",
    subtitle: "Western Astrology",
    symbol: "☿",
    description:
      "透過太陽、月亮、上升星座與行星相位，解讀性格本質、情感模式與生命課題。",
  },
];

export default function Home() {
  const [selectedType, setSelectedType] = useState<DivinationType | null>(null);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [streaming, setStreaming] = useState(false);

  const handleSubmit = useCallback(
    async (userMessage: string) => {
      if (!selectedType) return;

      setLoading(true);
      setContent("");
      setReasoning("");
      setStreaming(true);

      try {
        const response = await fetch("/api/divine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: selectedType, userMessage }),
        });

        if (!response.ok) {
          const error = await response.json();
          setContent(`錯誤：${error.error || "請求失敗"}`);
          setLoading(false);
          setStreaming(false);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                setContent((prev) => prev + parsed.content);
              }
              if (parsed.reasoning) {
                setReasoning((prev) => prev + parsed.reasoning);
              }
            } catch {
              // skip
            }
          }
        }
      } catch (err) {
        setContent(`連線錯誤：${err instanceof Error ? err.message : "未知錯誤"}`);
      } finally {
        setLoading(false);
        setStreaming(false);
      }
    },
    [selectedType]
  );

  return (
    <main className="relative z-10 flex-1">
      <SmokeParticles />

      {/* Top bar */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <ThemeToggle />
        <UserMenu />
      </div>

      {/* Header */}
      <header className="pt-16 pb-12 px-6 text-center">
        <h1
          className="animate-fade-in-up font-serif text-5xl sm:text-6xl font-bold tracking-[0.15em] text-gold"
          style={{ opacity: 0 }}
        >
          天命
        </h1>
        <p
          className="animate-fade-in-up mt-3 font-display text-lg sm:text-xl text-stone italic tracking-wide"
          style={{ animationDelay: "200ms", opacity: 0 }}
        >
          Divination by AI
        </p>
        <div
          className="animate-fade-in-up mx-auto mt-6 w-32 gold-line"
          style={{ animationDelay: "400ms", opacity: 0 }}
        />
      </header>

      {/* Divination Type Selection */}
      <section className="max-w-5xl mx-auto px-6 pb-8">
        <p
          className="animate-fade-in-up text-center text-sm text-mist/60 mb-8 tracking-wide"
          style={{ animationDelay: "500ms", opacity: 0 }}
        >
          選擇命理方式
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
          {DIVINATION_TYPES.map((dt, i) => (
            <DivinationCard
              key={dt.id}
              title={dt.title}
              subtitle={dt.subtitle}
              symbol={dt.symbol}
              description={dt.description}
              active={selectedType === dt.id}
              onClick={() => {
                setSelectedType(dt.id);
                setContent("");
                setReasoning("");
              }}
              delay={600 + i * 150}
            />
          ))}
        </div>
      </section>

      {/* Input Form */}
      {selectedType && (
        <section className="max-w-2xl mx-auto px-6 pb-8">
          <InputForm
            type={selectedType}
            onSubmit={handleSubmit}
            loading={loading}
          />
        </section>
      )}

      {/* Results */}
      {(content || reasoning) && (
        <section className="max-w-2xl mx-auto px-6 pb-16">
          <ResultDisplay
            content={content}
            reasoning={reasoning}
            streaming={streaming}
          />
        </section>
      )}

      {/* Footer */}
      <footer className="pb-8 text-center">
        <div className="mx-auto w-16 gold-line mb-4" />
        <p className="text-xs text-stone/40 tracking-widest font-display">
          Powered by Seed 2.0 Pro
        </p>
      </footer>
    </main>
  );
}
