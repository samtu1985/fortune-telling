"use client";

import { useState, useCallback, useRef, useEffect, type ChangeEvent } from "react";
import DivinationCard from "@/app/components/DivinationCard";
import InputForm from "@/app/components/InputForm";
import ResultDisplay from "@/app/components/ResultDisplay";
import SmokeParticles from "@/app/components/SmokeParticles";
import ThemeToggle from "@/app/components/ThemeToggle";
import UserMenu from "@/app/components/UserMenu";

type DivinationType = "bazi" | "ziwei" | "zodiac";

type Message = {
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  images?: string[];
};

function compressImage(dataUrl: string, maxWidth = 1024): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.src = dataUrl;
  });
}

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingReasoning, setStreamingReasoning] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const [followUpImages, setFollowUpImages] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const followUpFileRef = useRef<HTMLInputElement>(null);

  const conversationStarted = messages.length > 0 || streaming;

  // Auto-scroll to bottom during streaming or new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamingContent, streamingReasoning, messages.length]);

  const streamResponse = useCallback(
    async (chatMessages: { role: string; content: string; images?: string[] }[]) => {
      setLoading(true);
      setStreamingContent("");
      setStreamingReasoning("");
      setStreaming(true);

      try {
        const response = await fetch("/api/divine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: selectedType, messages: chatMessages }),
        });

        if (!response.ok) {
          const error = await response.json();
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `錯誤：${error.error || "請求失敗"}` },
          ]);
          setLoading(false);
          setStreaming(false);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";
        let fullReasoning = "";

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
                fullContent += parsed.content;
                setStreamingContent(fullContent);
              }
              if (parsed.reasoning) {
                fullReasoning += parsed.reasoning;
                setStreamingReasoning(fullReasoning);
              }
            } catch {
              // skip
            }
          }
        }

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: fullContent, reasoning: fullReasoning },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `連線錯誤：${err instanceof Error ? err.message : "未知錯誤"}`,
          },
        ]);
      } finally {
        setStreamingContent("");
        setStreamingReasoning("");
        setLoading(false);
        setStreaming(false);
      }
    },
    [selectedType]
  );

  const handleInitialSubmit = useCallback(
    async (userMessage: string, images?: string[]) => {
      const userMsg: Message = { role: "user", content: userMessage, images };
      setMessages([userMsg]);
      await streamResponse([{ role: "user", content: userMessage, images }]);
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    [streamResponse]
  );

  const handleFollowUpImageUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        if (file.size > 20 * 1024 * 1024) continue;
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const compressed = await compressImage(dataUrl);
        setFollowUpImages((prev) => [...prev, compressed]);
      }
      e.target.value = "";
    },
    []
  );

  const handleFollowUp = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if ((!followUp.trim() && followUpImages.length === 0) || loading) return;

      const userMsg = followUp.trim() || "請分析這張圖片";
      const imgs = followUpImages.length > 0 ? [...followUpImages] : undefined;
      setFollowUp("");
      setFollowUpImages([]);

      const updatedMessages: Message[] = [
        ...messages,
        { role: "user", content: userMsg, images: imgs },
      ];
      setMessages(updatedMessages);
      await streamResponse(
        updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
          images: m.images,
        }))
      );
    },
    [followUp, followUpImages, loading, messages, streamResponse]
  );

  const handleReset = useCallback(() => {
    setMessages([]);
    setSelectedType(null);
    setFollowUp("");
    setFollowUpImages([]);
    setStreamingContent("");
    setStreamingReasoning("");
  }, []);

  // ── Conversation mode ──
  if (conversationStarted) {
    return (
      <main className="relative z-10 flex flex-col h-dvh">
        <SmokeParticles />

        {/* Top bar */}
        <div className="relative z-20 flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-sm text-stone hover:text-mist transition-colors min-h-[44px] font-serif"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            重新選擇
          </button>

          <h1 className="absolute left-1/2 -translate-x-1/2 font-serif text-xl font-bold tracking-[0.15em] text-gold">
            天命
          </h1>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>

        {/* Divination type indicator */}
        <div className="text-center pb-2 shrink-0">
          <p className="text-xs text-stone/60 tracking-wide">
            {DIVINATION_TYPES.find((d) => d.id === selectedType)?.title}
          </p>
          <div className="mx-auto mt-2 w-24 gold-line" />
        </div>

        {/* Messages area — scrollable */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4"
        >
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map((msg, i) =>
              msg.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="bg-gold/8 border border-gold/15 rounded-lg px-4 py-3 max-w-[85%] text-sm text-cream/90 leading-relaxed">
                    {msg.images && msg.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {msg.images.map((img, j) => (
                          <img
                            key={j}
                            src={img}
                            alt=""
                            className="w-24 h-24 object-cover rounded border border-gold/20"
                          />
                        ))}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ) : (
                <div key={i}>
                  <ResultDisplay
                    content={msg.content}
                    reasoning={msg.reasoning || ""}
                    streaming={false}
                    hideDisclaimer
                  />
                </div>
              )
            )}

            {/* Currently streaming */}
            {streaming && (
              <div>
                <ResultDisplay
                  content={streamingContent}
                  reasoning={streamingReasoning}
                  streaming
                  hideDisclaimer
                />
              </div>
            )}
          </div>
        </div>

        {/* Follow-up input — pinned at bottom */}
        <div
          className="relative z-20 border-t border-gold/10 px-4 sm:px-6 py-4 shrink-0"
          style={{ background: "var(--parchment)" }}
        >
          <div className="max-w-2xl mx-auto">
            {/* Image preview */}
            {followUpImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {followUpImages.map((img, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={img}
                      alt=""
                      className="w-16 h-16 object-cover rounded border border-gold/20"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFollowUpImages((prev) =>
                          prev.filter((_, j) => j !== i)
                        )
                      }
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-seal text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleFollowUp} className="flex gap-2">
              <input
                ref={followUpFileRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFollowUpImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => followUpFileRef.current?.click()}
                disabled={loading}
                className="shrink-0 w-[44px] h-[44px] flex items-center justify-center rounded-sm border border-gold/15 text-gold-dim/60 hover:text-gold-dim hover:border-gold/30 transition-colors disabled:opacity-40"
                title="上傳圖片"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </button>
              <input
                ref={inputRef}
                type="text"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                placeholder="繼續追問..."
                disabled={loading}
                className="flex-1"
              />
              <button
                type="submit"
                disabled={
                  loading ||
                  (!followUp.trim() && followUpImages.length === 0)
                }
                className={`
                  px-5 py-2.5 rounded-sm text-sm tracking-widest font-serif transition-all duration-500
                  border border-gold/20
                  ${
                    loading ||
                    (!followUp.trim() && followUpImages.length === 0)
                      ? "text-gold-dim/50 cursor-not-allowed"
                      : "text-gold hover:bg-gold/15 active:scale-[0.98]"
                  }
                `}
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                ) : (
                  "送出"
                )}
              </button>
            </form>
            <p className="text-center text-xs text-stone/40 mt-2 tracking-wide">
              以上分析由 AI 生成，僅供參考
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ── Initial selection mode ──
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
            onSubmit={handleInitialSubmit}
            loading={loading}
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
