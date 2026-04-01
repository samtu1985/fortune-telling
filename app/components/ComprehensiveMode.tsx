"use client";

import { useState, useCallback, useRef, useEffect, type ChangeEvent } from "react";
import InputForm, { type ChartRequest, timeToShichen } from "./InputForm";
import ZiweiChart from "./ZiweiChart";
import ResultDisplay from "./ResultDisplay";
import ConfirmDialog from "./ConfirmDialog";
import MentionDropdown from "./MentionDropdown";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";
import SmokeParticles from "./SmokeParticles";

type Profile = {
  id: string;
  label: string;
  birthDate: string;
  birthTime: string;
  gender: string;
  birthPlace: string;
  calendarType: string;
  isLeapMonth: boolean;
  savedCharts?: { bazi?: string; ziwei?: string; zodiac?: string };
};

type MasterType = "bazi" | "ziwei" | "zodiac";

type MasterMessage = {
  role: "user" | "assistant";
  content: string;
  master?: MasterType;
};

const MASTERS: { id: MasterType; label: string; symbol: string; color: string; bgClass: string }[] = [
  { id: "bazi", label: "八字老師", symbol: "乾", color: "text-amber-400", bgClass: "border-amber-400/30 bg-amber-400/5" },
  { id: "ziwei", label: "紫微老師", symbol: "紫", color: "text-violet-400", bgClass: "border-violet-400/30 bg-violet-400/5" },
  { id: "zodiac", label: "星座老師", symbol: "☿", color: "text-cyan-400", bgClass: "border-cyan-400/30 bg-cyan-400/5" },
];

const MASTER_ORDER: MasterType[] = ["bazi", "ziwei", "zodiac"];

interface ComprehensiveModeProps {
  profiles: Profile[];
  onProfilesChange: () => void;
  onBack: () => void;
  reasoningDepth: string;
}

export default function ComprehensiveMode({
  profiles,
  onProfilesChange,
  onBack,
  reasoningDepth,
}: ComprehensiveModeProps) {
  // Phase: "input" → "charts" → "discussion"
  const [phase, setPhase] = useState<"input" | "charts" | "discussion">("input");
  const [chartLoading, setChartLoading] = useState(false);
  const [charts, setCharts] = useState<{ bazi?: string; ziwei?: string; zodiac?: string }>({});
  const [chartRequest, setChartRequest] = useState<ChartRequest | null>(null);
  const [aiQuestion, setAiQuestion] = useState("我的命運");

  // Discussion state
  const [messages, setMessages] = useState<MasterMessage[]>([]);
  const [streamingMaster, setStreamingMaster] = useState<MasterType | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [isAutoDiscussing, setIsAutoDiscussing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const [newDiscussionConfirm, setNewDiscussionConfirm] = useState(false);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<number>>(new Set());

  // Mention state
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef(true);
  const autoDiscussRef = useRef(false);
  const reasoningDepthRef = useRef(reasoningDepth);
  reasoningDepthRef.current = reasoningDepth;

  // Auto-scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 80;
  }, []);

  useEffect(() => {
    if (scrollRef.current && isNearBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamingContent, messages.length]);

  // Stream a single master's response
  const streamMaster = useCallback(
    async (master: MasterType, conversationMessages: MasterMessage[]): Promise<string> => {
      setStreamingMaster(master);
      setStreamingContent("");

      const response = await fetch("/api/divine-multi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          master,
          charts,
          messages: conversationMessages,
          reasoningDepth: reasoningDepthRef.current,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "API 錯誤");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

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
          } catch {
            // skip
          }
        }
      }

      setStreamingMaster(null);
      setStreamingContent("");
      return fullContent;
    },
    [charts]
  );

  // Run one full round: all three masters respond in order
  // Returns { messages, consensus } — consensus is true if [CONSENSUS] was detected
  const runRound = useCallback(
    async (currentMessages: MasterMessage[], isAutoRound = false): Promise<{ messages: MasterMessage[]; consensus: boolean }> => {
      setLoading(true);
      let msgs = [...currentMessages];
      let consensusReached = false;

      for (const master of MASTER_ORDER) {
        // Only check stop signal during auto-discussion rounds (not the first round)
        if (isAutoRound && !autoDiscussRef.current) {
          break;
        }

        try {
          const content = await streamMaster(master, msgs);

          // Check for consensus marker
          const hasConsensus = content.includes("[CONSENSUS]");
          const cleanContent = content.replace(/\s*\[CONSENSUS\]\s*/g, "").trim();

          const newMsg: MasterMessage = { role: "assistant", content: cleanContent, master };
          msgs = [...msgs, newMsg];
          setMessages(msgs);

          if (hasConsensus) {
            consensusReached = true;
            // Stop auto-discussion
            autoDiscussRef.current = false;
            break;
          }
        } catch (err) {
          const errorMsg: MasterMessage = {
            role: "assistant",
            content: `連線錯誤：${err instanceof Error ? err.message : "未知錯誤"}`,
            master,
          };
          msgs = [...msgs, errorMsg];
          setMessages(msgs);
          break;
        }
      }

      setLoading(false);
      return { messages: msgs, consensus: consensusReached };
    },
    [streamMaster]
  );

  // Generate all three charts
  const handleGenerateCharts = useCallback(
    async (request: ChartRequest) => {
      setChartLoading(true);
      setChartRequest(request);

      try {
        const types: MasterType[] = ["bazi", "ziwei", "zodiac"];
        const results = await Promise.all(
          types.map(async (type) => {
            const res = await fetch("/api/chart", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type,
                birthDate: request.birthDate,
                birthTime: request.birthTime,
                gender: request.gender,
                birthPlace: request.birthPlace,
                isLunar: request.calendarType === "lunar",
                isLeapMonth: request.isLeapMonth,
              }),
            });
            if (!res.ok) return null;
            const data = await res.json();
            return data.chart as string;
          })
        );

        setCharts({
          bazi: results[0] || undefined,
          ziwei: results[1] || undefined,
          zodiac: results[2] || undefined,
        });
        setPhase("charts");
      } catch {
        alert("命盤生成失敗");
      } finally {
        setChartLoading(false);
      }
    },
    []
  );

  // Start the initial discussion round
  const handleStartDiscussion = useCallback(async () => {
    if (!aiQuestion.trim()) return;
    setPhase("discussion");
    isNearBottomRef.current = true;

    const isChineseType = true;
    const shichen = isChineseType ? timeToShichen(chartRequest?.birthTime || "") : "";
    const calendarLabel = chartRequest?.calendarType === "lunar" ? "農曆" : "國曆";

    const birthInfo = `出生日期：${chartRequest?.birthDate}（${calendarLabel}）
出生時間：${chartRequest?.birthTime}${shichen ? `（${shichen}）` : ""}
出生地點：${chartRequest?.birthPlace}
性別：${chartRequest?.gender || "未提供"}`;

    const userMsg: MasterMessage = {
      role: "user",
      content: `${birthInfo}\n\n想深入探討的議題：${aiQuestion}`,
    };

    const initialMessages = [userMsg];
    setMessages(initialMessages);

    // First round: each master gives their initial analysis
    const firstResult = await runRound(initialMessages);

    // Auto-start follow-up discussion if no consensus yet
    if (!firstResult.consensus) {
      autoDiscussRef.current = true;
      setIsAutoDiscussing(true);
      await runAutoLoop(firstResult.messages);
    }

    setTimeout(() => inputRef.current?.focus(), 100);
  }, [aiQuestion, chartRequest, runRound]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shared auto-discussion loop — called from multiple places
  const runAutoLoop = useCallback(async (startMessages: MasterMessage[]) => {
    let currentMsgs = startMessages;

    while (autoDiscussRef.current) {
      const contextMsg: MasterMessage = {
        role: "user",
        content: "請針對前面其他老師已經提出的觀點進行回應，不要重複自己先前說過的分析。可以補充新的角度、引用不同的命盤依據來佐證或反駁。如果三位老師大致上已經達到一致意見，就由你進行總結。",
      };
      currentMsgs = [...currentMsgs, contextMsg];
      setMessages(currentMsgs);

      const result = await runRound(currentMsgs, true);
      currentMsgs = result.messages;

      if (result.consensus) break;

      if (autoDiscussRef.current) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    setIsAutoDiscussing(false);
    autoDiscussRef.current = false;
  }, [runRound]);

  // Start auto-discussion (can be called while a round is in progress)
  const handleStartAutoDiscuss = useCallback(async () => {
    if (isAutoDiscussing) return; // already running
    autoDiscussRef.current = true;
    setIsAutoDiscussing(true);

    // If currently loading (a round is in progress), don't start a new loop.
    // The flag is set — when the current operation finishes, it will check
    // and continue automatically via the effect below.
    if (!loading) {
      await runAutoLoop([...messages]);
    }
  }, [isAutoDiscussing, loading, messages, runAutoLoop]);

  const handleStopAutoDiscuss = useCallback(() => {
    autoDiscussRef.current = false;
    // isAutoDiscussing will be set to false when the current round finishes
  }, []);

  // When loading finishes and auto-discuss flag is on, continue the loop
  const prevLoadingRef = useRef(false);
  useEffect(() => {
    if (prevLoadingRef.current && !loading && autoDiscussRef.current && !isAutoDiscussing) {
      // A round just finished and user toggled auto on during it
      setIsAutoDiscussing(true);
      runAutoLoop([...messages]);
    }
    prevLoadingRef.current = loading;
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow-up question
  const handleFollowUp = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!followUp.trim() || loading) return;
      isNearBottomRef.current = true;
      setMentionOpen(false);

      const userMsg: MasterMessage = { role: "user", content: followUp.trim() };
      setFollowUp("");

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      await runRound(updatedMessages);
    },
    [followUp, loading, messages, runRound]
  );

  // Mention handling
  const handleFollowUpChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setFollowUp(val);
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([^\s@]*)$/);
    if (atMatch) {
      setMentionOpen(true);
      setMentionQuery(atMatch[1]);
    } else {
      setMentionOpen(false);
      setMentionQuery("");
    }
  }, []);

  const mentionProfiles = profiles.map((p) => ({
    id: p.id,
    label: p.label,
    hasChart: !!(p.savedCharts?.bazi || p.savedCharts?.ziwei || p.savedCharts?.zodiac),
  }));

  const handleMentionSelect = useCallback(
    (label: string) => {
      const textarea = inputRef.current;
      if (!textarea) return;
      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = followUp.slice(0, cursorPos);
      const textAfterCursor = followUp.slice(cursorPos);
      const atIdx = textBeforeCursor.lastIndexOf("@");
      if (atIdx === -1) return;
      const newText = textBeforeCursor.slice(0, atIdx) + `@${label} ` + textAfterCursor;
      setFollowUp(newText);
      setMentionOpen(false);
      setTimeout(() => {
        textarea.focus();
        const newCursor = atIdx + label.length + 2;
        textarea.setSelectionRange(newCursor, newCursor);
      }, 0);
    },
    [followUp]
  );

  // Save conversation
  const handleSaveConversation = useCallback(
    async (messageIndex: number) => {
      const aiMsg = messages[messageIndex];
      if (!aiMsg || aiMsg.role !== "assistant") return;

      let userQuestion = "";
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          userQuestion = messages[i].content;
          break;
        }
      }

      const masterLabel = MASTERS.find((m) => m.id === aiMsg.master)?.label;

      await fetch("/api/saved-conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "bazi", // save under bazi for now
          userQuestion,
          aiResponse: `【${masterLabel}】${aiMsg.content}`,
          profileLabel: chartRequest?.profileLabel,
        }),
      });

      setSavedMessageIds((prev) => new Set(prev).add(messageIndex));
    },
    [messages, chartRequest]
  );

  const handleNewDiscussion = useCallback(() => {
    setPhase("input");
    setCharts({});
    setChartRequest(null);
    setMessages([]);
    setStreamingContent("");
    setStreamingMaster(null);
    setIsAutoDiscussing(false);
    autoDiscussRef.current = false;
    setSavedMessageIds(new Set());
    setNewDiscussionConfirm(false);
    setAiQuestion("我的命運");
  }, []);

  const getMasterInfo = (id?: MasterType) => MASTERS.find((m) => m.id === id);

  // Ziwei visual chart info
  const ziweiBirthInfo = chartRequest
    ? (() => {
        const [h] = chartRequest.birthTime.split(":").map(Number);
        let timeIdx = 0;
        if (h >= 23 || h < 1) timeIdx = 0;
        else if (h < 3) timeIdx = 1;
        else if (h < 5) timeIdx = 2;
        else if (h < 7) timeIdx = 3;
        else if (h < 9) timeIdx = 4;
        else if (h < 11) timeIdx = 5;
        else if (h < 13) timeIdx = 6;
        else if (h < 15) timeIdx = 7;
        else if (h < 17) timeIdx = 8;
        else if (h < 19) timeIdx = 9;
        else if (h < 21) timeIdx = 10;
        else timeIdx = 11;
        return {
          birthday: chartRequest.birthDate,
          birthTime: timeIdx,
          gender: (chartRequest.gender === "女" ? "女" : "男") as "男" | "女",
          birthdayType: (chartRequest.calendarType === "lunar" ? "lunar" : "solar") as "lunar" | "solar",
        };
      })()
    : null;

  // ── Input Phase ──
  if (phase === "input") {
    return (
      <main className="relative z-10 flex-1">
        <SmokeParticles />
        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-stone hover:text-mist transition-colors min-h-[44px] font-serif"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
            返回選擇
          </button>
        </div>
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <ThemeToggle />
          <UserMenu />
        </div>

        <header className="pt-16 pb-8 px-6 text-center">
          <h1 className="text-3xl font-bold tracking-[0.15em] text-gold" style={{ fontFamily: "var(--font-calligraphy)" }}>
            三師論道
          </h1>
          <p className="mt-2 text-sm text-stone italic font-display">Comprehensive Analysis</p>
          <div className="mx-auto mt-4 w-24 gold-line" />
        </header>

        <section className="max-w-2xl mx-auto px-6 pb-8">
          <InputForm
            type="bazi"
            onSubmit={handleGenerateCharts}
            loading={chartLoading}
            profiles={profiles}
            onProfilesChange={onProfilesChange}
          />
        </section>
      </main>
    );
  }

  // ── Charts Preview Phase ──
  if (phase === "charts") {
    return (
      <main className="relative z-10 flex-1 overflow-y-auto">
        <SmokeParticles />
        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={() => setPhase("input")}
            className="flex items-center gap-1.5 text-sm text-stone hover:text-mist transition-colors min-h-[44px] font-serif"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
            返回修改
          </button>
        </div>
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <ThemeToggle />
          <UserMenu />
        </div>

        <header className="pt-16 pb-6 px-6 text-center">
          <h1 className="text-2xl font-bold tracking-[0.15em] text-gold" style={{ fontFamily: "var(--font-calligraphy)" }}>
            三師論道 — 命盤總覽
          </h1>
          <div className="mx-auto mt-4 w-24 gold-line" />
        </header>

        <section className="max-w-6xl mx-auto px-4 pb-6">
          {/* Ziwei visual chart */}
          {ziweiBirthInfo && charts.ziwei && (
            <div className="mb-6">
              <ZiweiChart {...ziweiBirthInfo} />
            </div>
          )}

          {/* Three charts in columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {MASTERS.map((m) => {
              const chart = charts[m.id];
              return (
                <div
                  key={m.id}
                  className={`rounded-lg border p-4 ${m.bgClass}`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xl ${m.color}`}>{m.symbol}</span>
                    <span className={`text-sm font-serif font-semibold ${m.color}`}>{m.label}</span>
                  </div>
                  {chart ? (
                    <pre className="text-xs text-stone leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                      {chart.replace(/<[^>]+>/g, "").trim()}
                    </pre>
                  ) : (
                    <p className="text-xs text-stone/50">命盤生成失敗</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Start discussion */}
        <section className="max-w-2xl mx-auto px-6 pb-12">
          <div className="border-t border-gold/10 pt-5 space-y-3">
            <label className="text-sm font-serif text-gold">想深入探討的議題</label>
            <input
              type="text"
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              placeholder="例：事業方向、感情發展、近期運勢..."
            />
            <button
              onClick={handleStartDiscussion}
              disabled={!aiQuestion.trim() || !charts.bazi}
              className="w-full py-3.5 rounded-sm text-base text-gold border border-gold/20 bg-gold/15 hover:bg-gold/25 transition-colors font-serif tracking-widest disabled:opacity-40"
            >
              進入討論
            </button>
          </div>
        </section>
      </main>
    );
  }

  // ── Discussion Phase ──
  return (
    <main className="relative z-10 flex flex-col h-dvh">
      <SmokeParticles />

      {/* Top bar */}
      <div className="relative z-20 flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-stone hover:text-mist transition-colors min-h-[44px] font-serif"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          返回選擇
        </button>

        <h1 className="absolute left-1/2 -translate-x-1/2 text-xl font-bold tracking-[0.15em] text-gold" style={{ fontFamily: "var(--font-calligraphy)" }}>
          三師論道
        </h1>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>

      {/* Master indicators */}
      <div className="flex justify-center gap-3 px-4 pb-2 shrink-0">
        {MASTERS.map((m) => (
          <div key={m.id} className="flex items-center gap-1.5">
            <span className={`text-sm ${m.color}`}>{m.symbol}</span>
            <span className={`text-xs font-serif ${m.color}`}>{m.label}</span>
            {streamingMaster === m.id && (
              <span className={`inline-block w-1.5 h-1.5 rounded-full animate-pulse ${m.color === "text-amber-400" ? "bg-amber-400" : m.color === "text-violet-400" ? "bg-violet-400" : "bg-cyan-400"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="text-center pb-2 shrink-0">
        <div className="mx-auto mt-1 w-24 gold-line" />
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto">
          {/* Charts reference at top of discussion */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            {MASTERS.map((m) => {
              const chart = charts[m.id];
              if (!chart) return null;
              return (
                <details
                  key={m.id}
                  className={`rounded-lg border overflow-hidden ${m.bgClass}`}
                >
                  <summary className="px-3 py-2 cursor-pointer hover:bg-gold/5 transition-colors flex items-center gap-1.5 text-xs">
                    <span className={m.color}>{m.symbol}</span>
                    <span className={`font-serif ${m.color}`}>{m.label}命盤</span>
                    <svg className="w-3 h-3 text-stone/30 ml-auto transition-transform details-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </summary>
                  <div className="px-3 pb-3 border-t border-gold/5">
                    <pre className="text-[10px] text-stone/70 leading-relaxed whitespace-pre-wrap mt-2 max-h-48 overflow-y-auto">
                      {chart.replace(/<[^>]+>/g, "").trim()}
                    </pre>
                  </div>
                </details>
              );
            })}
          </div>

          {/* Ziwei visual chart */}
          {ziweiBirthInfo && charts.ziwei && (
            <div className="mb-6">
              <ZiweiChart {...ziweiBirthInfo} />
            </div>
          )}
        </div>

        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg, i) => {
            if (msg.role === "user") {
              // Hide auto-discussion system prompts from the UI
              if (msg.content.startsWith("請針對前面其他老師")) return null;
              return (
                <div key={i} className="flex justify-end">
                  <div className="bg-gold/8 border border-gold/15 rounded-lg px-4 py-3 max-w-[85%] text-sm text-cream/90 leading-relaxed">
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              );
            }

            const masterInfo = getMasterInfo(msg.master);
            const masterColor = masterInfo?.color || "text-cream";
            const masterBg = masterInfo?.bgClass || "";

            return (
              <div key={i} className="flex justify-start">
                <div className={`border rounded-lg px-4 py-3 max-w-[90%] ${masterBg}`}>
                  {/* Master badge */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className={`text-base ${masterColor}`}>{masterInfo?.symbol}</span>
                    <span className={`text-xs font-serif font-semibold ${masterColor}`}>{masterInfo?.label}</span>
                  </div>
                  <div className="text-sm text-cream/90 leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>
                  {/* Save button */}
                  <div className="flex justify-end mt-1">
                    <button
                      onClick={() => handleSaveConversation(i)}
                      disabled={savedMessageIds.has(i)}
                      className={`text-xs flex items-center gap-1 min-h-[28px] px-1.5 transition-colors ${
                        savedMessageIds.has(i) ? "text-gold-dim/50" : "text-stone/40 hover:text-gold-dim"
                      }`}
                    >
                      {savedMessageIds.has(i) ? (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          已保存
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                          保存
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Currently streaming */}
          {streamingMaster && streamingContent && (
            <div className="flex justify-start">
              {(() => {
                const masterInfo = getMasterInfo(streamingMaster);
                return (
                  <div className={`border rounded-lg px-4 py-3 max-w-[90%] ${masterInfo?.bgClass || ""}`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className={`text-base ${masterInfo?.color}`}>{masterInfo?.symbol}</span>
                      <span className={`text-xs font-serif font-semibold ${masterInfo?.color}`}>{masterInfo?.label}</span>
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold/60 animate-pulse" />
                    </div>
                    <div className="text-sm text-cream/90 leading-relaxed whitespace-pre-wrap streaming-cursor">
                      {streamingContent}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div
        className="relative z-20 border-t border-gold/10 px-4 sm:px-6 py-4 shrink-0"
        style={{ background: "var(--parchment)" }}
      >
        <div className="max-w-2xl mx-auto">
          {/* Auto-discuss controls */}
          <div className="flex justify-center gap-3 mb-3">
            {!isAutoDiscussing ? (
              <button
                onClick={handleStartAutoDiscuss}
                disabled={messages.length === 0}
                className="px-4 py-2 text-xs text-gold-dim border border-gold/15 rounded-full hover:bg-gold/10 transition-colors disabled:opacity-40"
              >
                {loading ? "等待發言完成後開始..." : "開始 AI 自動對話"}
              </button>
            ) : (
              <button
                onClick={handleStopAutoDiscuss}
                className="px-4 py-2 text-xs text-red-seal border border-red-seal/30 rounded-full hover:bg-red-seal/10 transition-colors"
              >
                停止 AI 自動對話
              </button>
            )}
          </div>

          {/* Follow-up input */}
          <form onSubmit={handleFollowUp} className="flex gap-2">
            <div className="relative flex-1">
              {mentionOpen && (
                <MentionDropdown
                  profiles={mentionProfiles}
                  query={mentionQuery}
                  onSelect={handleMentionSelect}
                  onClose={() => setMentionOpen(false)}
                />
              )}
              <textarea
                ref={inputRef}
                value={followUp}
                onChange={handleFollowUpChange}
                onKeyDown={(e) => {
                  if (mentionOpen) return;
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    if (followUp.trim()) {
                      e.currentTarget.form?.requestSubmit();
                    }
                  }
                }}
                placeholder="追問三位老師... 輸入 @ 可引用已保存的命盤"
                disabled={loading || isAutoDiscussing}
                rows={3}
                className="flex-1 w-full resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading || isAutoDiscussing || !followUp.trim()}
              className={`px-5 py-2.5 rounded-sm text-sm tracking-widest font-serif transition-all duration-500 border border-gold/20 ${
                loading || isAutoDiscussing || !followUp.trim()
                  ? "text-gold-dim/50 cursor-not-allowed"
                  : "text-gold hover:bg-gold/15 active:scale-[0.98]"
              }`}
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

          <button
            onClick={() => setNewDiscussionConfirm(true)}
            className="w-full mt-3 py-2 text-xs text-stone/40 hover:text-stone/60 transition-colors tracking-wide"
          >
            開始新討論
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={newDiscussionConfirm}
        title="開始新討論"
        message="目前的對話將會清除，確定要開始新討論嗎？"
        confirmLabel="確定"
        onConfirm={handleNewDiscussion}
        onCancel={() => setNewDiscussionConfirm(false)}
      />
    </main>
  );
}
