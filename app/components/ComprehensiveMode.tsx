"use client";

import { useState, useCallback, useRef, useEffect, type ChangeEvent } from "react";
import InputForm, { type ChartRequest, timeToShichen } from "./InputForm";
import ZiweiChart from "./ZiweiChart";
import DOMPurify from "dompurify";
import ResultDisplay, { renderMarkdown } from "./ResultDisplay";
import ConfirmDialog from "./ConfirmDialog";
import MentionDropdown from "./MentionDropdown";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";
import SmokeParticles from "./SmokeParticles";
import { useLocale } from "./LocaleProvider";
import { useAudioQueue, type AudioSegment } from "@/app/hooks/useAudioQueue";

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

const MASTERS_BASE: { id: MasterType; labelKey: string; symbol: string; color: string; bgClass: string }[] = [
  { id: "bazi", labelKey: "master.bazi", symbol: "乾", color: "text-amber-400", bgClass: "border-amber-400/30 bg-amber-400/5" },
  { id: "ziwei", labelKey: "master.ziwei", symbol: "紫", color: "text-violet-400", bgClass: "border-violet-400/30 bg-violet-400/5" },
  { id: "zodiac", labelKey: "master.zodiac", symbol: "☿", color: "text-cyan-400", bgClass: "border-cyan-400/30 bg-cyan-400/5" },
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
  const { locale, t } = useLocale();

  const MASTERS = MASTERS_BASE.map((m) => ({ ...m, label: t(m.labelKey) }));

  // Phase: "input" → "charts" → "discussion"
  const [phase, setPhase] = useState<"input" | "charts" | "discussion">("input");
  const [chartLoading, setChartLoading] = useState(false);
  const [charts, setCharts] = useState<{ bazi?: string; ziwei?: string; zodiac?: string }>({});
  const [chartRequest, setChartRequest] = useState<ChartRequest | null>(null);
  const [aiQuestion, setAiQuestion] = useState(t("main.defaultQuestion"));

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
  const [mobileControlsOpen, setMobileControlsOpen] = useState(true);

  const [discussionEnded, setDiscussionEnded] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [podcastMode, setPodcastMode] = useState(false);
  const [ttsGeneratingCount, setTtsGeneratingCount] = useState(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const audioQueue = useAudioQueue();
  const [casePhase, setCasePhase] = useState<"idle" | "consent" | "processing" | "preview" | "done">("idle");
  const [caseSummary, setCaseSummary] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef(true);
  const autoDiscussRef = useRef(false);
  const roundCountRef = useRef(0);
  const reasoningDepthRef = useRef(reasoningDepth);
  reasoningDepthRef.current = reasoningDepth;
  const podcastModeRef = useRef(false);
  const fetchTTSRef = useRef<((master: MasterType, text: string) => Promise<void>) | null>(null);
  const audioQueueRef = useRef<ReturnType<typeof useAudioQueue> | null>(null);

  const MAX_ROUNDS = 3;

  // Auto-scroll + collapse mobile controls on scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const threshold = window.innerWidth < 640 ? 200 : 80;
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < threshold;
    // On mobile, collapse controls when user scrolls up
    if (window.innerWidth < 640 && !isNearBottomRef.current) {
      setMobileControlsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current && isNearBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamingContent, messages.length]);

  // Release wake lock when discussion ends or all audio finishes
  useEffect(() => {
    if (discussionEnded && !audioQueue.isPlaying && wakeLockRef.current) {
      wakeLockRef.current.release().then(() => {
        console.log("[wakeLock] Released");
        wakeLockRef.current = null;
      }).catch(() => {});
    }
  }, [discussionEnded, audioQueue.isPlaying]);

  // Auto-collapse mobile controls when AI starts responding
  useEffect(() => {
    if ((loading || isAutoDiscussing) && window.innerWidth < 640) {
      setMobileControlsOpen(false);
    }
  }, [loading, isAutoDiscussing]);

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
          locale,
        }),
      });

      if (!response.ok) {
        let errMsg = `${t("comprehensive.apiError")} ${response.status}`;
        try {
          const err = await response.json();
          if (err.error) errMsg = err.error;
        } catch {
          // Response might not be JSON (e.g. Vercel error page)
        }
        throw new Error(errMsg);
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
    [charts, locale, t]
  );

  // Run one full round: all three masters respond in order
  // Returns { messages, consensus } — consensus is true if [CONSENSUS] was detected
  const runRound = useCallback(
    async (currentMessages: MasterMessage[], isAutoRound = false): Promise<{ messages: MasterMessage[]; consensus: boolean }> => {
      setLoading(true);
      let msgs = [...currentMessages];
      let consensusReached = false;

      for (let mi = 0; mi < MASTER_ORDER.length; mi++) {
        const master = MASTER_ORDER[mi];
        const isLastMaster = mi === MASTER_ORDER.length - 1;

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

          // Trigger TTS in background (don't block next master)
          if (podcastModeRef.current && fetchTTSRef.current) {
            console.log("[tts] Triggering TTS for", master, "text length:", cleanContent.length);
            fetchTTSRef.current(master, cleanContent);
          } else {
            console.log("[tts] Skipped - podcastMode:", podcastModeRef.current, "fetchTTS:", !!fetchTTSRef.current);
          }

          // Only stop the round on consensus if this is the last master
          // so every master gets a chance to speak each round
          if (hasConsensus && isLastMaster) {
            consensusReached = true;
            autoDiscussRef.current = false;
            break;
          }
        } catch (err) {
          const errorMsg: MasterMessage = {
            role: "assistant",
            content: `${t("comprehensive.connectionError")}${err instanceof Error ? err.message : "未知錯誤"}`,
            master,
          };
          msgs = [...msgs, errorMsg];
          setMessages(msgs);
          break;
        }
      }

      // If any master marked consensus but wasn't the last, check after the full round
      if (!consensusReached) {
        const lastThree = msgs.slice(-MASTER_ORDER.length);
        if (lastThree.some((m) => m.role === "assistant" && m.content.includes("[CONSENSUS]"))) {
          // Shouldn't happen since we strip [CONSENSUS], but safety check
          consensusReached = true;
          autoDiscussRef.current = false;
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
        alert(t("comprehensive.chartGenFailed"));
      } finally {
        setChartLoading(false);
      }
    },
    []
  );

  // Start the initial discussion round
  const handleStartDiscussion = useCallback(async () => {
    if (!aiQuestion.trim()) return;
    // Unlock iOS audio on user gesture (must happen synchronously in tap handler)
    // IMPORTANT: unlockAudio() must be the FIRST thing called in this handler
    if (podcastMode) {
      audioQueue.unlockAudio();
    }
    setPhase("discussion");
    // Request Wake Lock AFTER phase change (async, won't block audio unlock)
    if (podcastMode && "wakeLock" in navigator) {
      try {
        navigator.wakeLock.request("screen").then((lock) => {
          wakeLockRef.current = lock;
          console.log("[wakeLock] Screen wake lock acquired");
        }).catch((e) => console.warn("[wakeLock] Failed:", e));
      } catch { /* ignore */ }
    }
    // Consume multi credit
    fetch("/api/credits/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "multi" }),
    }).catch(() => {});
    isNearBottomRef.current = true;
    roundCountRef.current = 0;
    setDiscussionEnded(false);

    const isChineseType = true;
    const shichen = isChineseType ? timeToShichen(chartRequest?.birthTime || "") : "";
    const calendarLabel = chartRequest?.calendarType === "lunar" ? t("comprehensive.lunar") : t("comprehensive.solar");

    const birthInfo = `${t("birth.date")}：${chartRequest?.birthDate}（${calendarLabel}）
${t("birth.time")}：${chartRequest?.birthTime}${shichen ? `（${shichen}）` : ""}
${t("birth.place")}：${chartRequest?.birthPlace}
${t("birth.gender")}：${chartRequest?.gender || "未提供"}`;

    const userMsg: MasterMessage = {
      role: "user",
      content: `${birthInfo}\n\n${t("birth.topic")}：${aiQuestion}`,
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
      roundCountRef.current += 1;
      const isLastRound = roundCountRef.current >= MAX_ROUNDS;

      const contextMsg: MasterMessage = {
        role: "user",
        content: isLastRound
          ? "這是最後一輪討論。請每位老師做最後總結：1. 你的核心觀點 2. 跟其他老師最大的分歧點 3. 給問卦者最重要的一個建議。最後由星座老師統整三位老師的共識與分歧，加上 [CONSENSUS] 標記。"
          : "請針對前面其他老師已經提出的觀點進行回應，特別是你不同意或有不同解讀的地方。不要重複自己先前說過的分析。重點放在：1. 指出其他老師的分析哪裡跟你的系統看法不同 2. 用你的命盤依據反駁或提出替代解讀 3. 如果真的同意，也要補充對方沒提到的面向。只有在三位老師已經充分交鋒、具體問題上真正取得一致後，才由星座老師做總結。",
      };
      currentMsgs = [...currentMsgs, contextMsg];
      setMessages(currentMsgs);

      const result = await runRound(currentMsgs, true);
      currentMsgs = result.messages;

      if (result.consensus || isLastRound) {
        setDiscussionEnded(true);
        break;
      }

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
  // Inject @mentioned profiles' chart data into the message for synastry analysis
  const injectMentionCharts = useCallback(
    (message: string): string => {
      const mentionRegex = /@(\S+)/g;
      let match;
      const injections: string[] = [];

      while ((match = mentionRegex.exec(message)) !== null) {
        const label = match[1];
        const profile = profiles.find((p) => p.label === label);
        if (!profile) continue;

        const savedCharts = profile.savedCharts;
        if (!savedCharts?.bazi && !savedCharts?.ziwei && !savedCharts?.zodiac) {
          injections.push(
            `\n\n【系統提示】使用者提到了「${label}」，但此人尚未生成並保存命盤。請提醒使用者先為「${label}」生成命盤後再進行合盤分析。`
          );
          continue;
        }

        injections.push(`\n\n【以下是「${label}」由排盤程式精確計算的命盤數據，進行合盤分析時必須完全依照這些數據，不得自行排盤或編造任何數據】`);
        if (savedCharts.bazi) {
          injections.push(`\n【${label}的八字命盤】\n${savedCharts.bazi}`);
        }
        if (savedCharts.ziwei) {
          injections.push(`\n【${label}的紫微命盤】\n${savedCharts.ziwei}`);
        }
        if (savedCharts.zodiac) {
          injections.push(`\n【${label}的西洋星盤】\n${savedCharts.zodiac}`);
        }
      }

      return message + injections.join("");
    },
    [profiles]
  );

  const handleFollowUp = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!followUp.trim() || loading) return;
      isNearBottomRef.current = true;
      setMentionOpen(false);

      const rawMsg = followUp.trim();
      const msgWithCharts = injectMentionCharts(rawMsg);
      setFollowUp("");

      // Store chart-injected content in the message itself — the chart data
      // is essential context for the AI masters to do synastry analysis
      const userMsg: MasterMessage = { role: "user", content: msgWithCharts };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      await runRound(updatedMessages);
    },
    [followUp, loading, messages, runRound, injectMentionCharts]
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
    audioQueueRef.current?.stop();
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
    setPodcastMode(false);
    setPhase("input");
    setCharts({});
    setChartRequest(null);
    setMessages([]);
    setStreamingContent("");
    setStreamingMaster(null);
    setIsAutoDiscussing(false);
    autoDiscussRef.current = false;
    roundCountRef.current = 0;
    setDiscussionEnded(false);
    setSavedMessageIds(new Set());
    setNewDiscussionConfirm(false);
    setAiQuestion(t("main.defaultQuestion"));
    setCasePhase("idle");
    setCaseSummary("");
  }, [t]);

  const getMasterInfo = (id?: MasterType) => MASTERS.find((m) => m.id === id);

  // Fetch TTS audio for a master's response
  const fetchTTS = useCallback(
    async (master: MasterType, text: string): Promise<void> => {
      console.log("[tts] fetchTTS called for", master, "locale:", locale, "text:", text.slice(0, 50));
      setTtsGeneratingCount((c) => c + 1);
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, masterKey: master, locale }),
        });
        if (!res.ok) {
          console.warn("[tts] Failed for", master, res.status);
          return;
        }
        const buffer = await res.arrayBuffer();
        const blob = new Blob([buffer], { type: "audio/mpeg" });
        const audioUrl = URL.createObjectURL(blob);
        audioQueue.enqueue({ masterKey: master, audioUrl, audioBuffer: buffer });
      } catch (e) {
        console.warn("[tts] Error:", e);
      } finally {
        setTtsGeneratingCount((c) => Math.max(0, c - 1));
      }
    },
    [locale, audioQueue]
  );
  // Keep refs in sync so runRound can access latest values without stale closures
  podcastModeRef.current = podcastMode;
  fetchTTSRef.current = fetchTTS;
  audioQueueRef.current = audioQueue;

  // PDF download
  const handleDownloadPdf = useCallback(async () => {
    setPdfGenerating(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { jsPDF } = await import("jspdf");

      const MASTER_COLORS: Record<string, string> = {
        bazi: "#d97706",
        ziwei: "#8b5cf6",
        zodiac: "#06b6d4",
      };

      // Build HTML — each message block is a separate div for page-break control
      const container = document.createElement("div");
      container.style.cssText = "width:700px;padding:40px;font-family:serif;background:#fff;color:#1e1a14;position:absolute;left:-9999px;top:0;";

      // Header
      const header = `
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#7a5c10;font-size:28px;margin:0;">天機 FortuneFor.me</h1>
          <p style="color:#847b72;font-size:13px;margin-top:4px;">三師論道 — ${t("comprehensive.discussionEnded")}</p>
          <div style="width:80px;height:1px;background:linear-gradient(90deg,transparent,#7a5c10,transparent);margin:16px auto;"></div>
        </div>`;

      // User question
      const userBlock = messages
        .filter((m) => m.role === "user" && !m.content.startsWith("請針對") && !m.content.startsWith("這是最後"))
        .slice(0, 1)
        .map((m) => `<div style="background:#f5f0e5;border-radius:8px;padding:16px;margin-bottom:16px;font-size:13px;line-height:1.8;white-space:pre-wrap;">${m.content.replace(/\n\n【(以下是|系統提示)[\s\S]*$/, "").replace(/</g, "&lt;")}</div>`)
        .join("");

      // Master messages
      const masterBlocks = messages
        .filter((m) => m.role === "assistant" && m.master)
        .map((m) => {
          const color = MASTER_COLORS[m.master!] || "#666";
          const info = getMasterInfo(m.master);
          return `<div class="pdf-block" style="border-left:3px solid ${color};padding:12px 16px;margin-bottom:12px;background:${color}08;border-radius:0 8px 8px 0;page-break-inside:avoid;">
            <div style="font-size:14px;font-weight:600;color:${color};margin-bottom:8px;">${info?.symbol || ""} ${info?.label || m.master}</div>
            <div style="font-size:13px;line-height:1.8;white-space:pre-wrap;">${renderMarkdown(m.content)}</div>
          </div>`;
        });

      const footer = `<div style="text-align:center;margin-top:24px;color:#847b72;font-size:11px;">
        <p>以上分析由 AI 生成，僅供參考</p>
        <p style="margin-top:4px;">${new Date().toLocaleDateString()}</p>
      </div>`;

      container.innerHTML = header + userBlock + masterBlocks.join("") + footer;
      document.body.appendChild(container);

      // Render each block separately and place on PDF pages
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 5;
      const usableHeight = pageHeight - margin * 2;
      let yOffset = margin;

      // Get all top-level children as separate blocks
      const blocks = Array.from(container.children) as HTMLElement[];

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const blockCanvas = await html2canvas(block, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
        const blockImgHeight = (blockCanvas.height * (pageWidth - margin * 2)) / blockCanvas.width;

        // If block doesn't fit on current page, start a new page
        if (yOffset + blockImgHeight > pageHeight - margin && yOffset > margin + 10) {
          pdf.addPage();
          yOffset = margin;
        }

        // If a single block is taller than a page, split it across pages
        if (blockImgHeight > usableHeight) {
          const imgData = blockCanvas.toDataURL("image/jpeg", 0.95);
          const totalImgWidth = pageWidth - margin * 2;
          let drawn = 0;
          while (drawn < blockImgHeight) {
            if (drawn > 0) {
              pdf.addPage();
              yOffset = margin;
            }
            const drawHeight = Math.min(usableHeight, blockImgHeight - drawn);
            // Use canvas clipping for clean page breaks
            const clipCanvas = document.createElement("canvas");
            const srcPixelsPerMm = blockCanvas.width / totalImgWidth;
            clipCanvas.width = blockCanvas.width;
            clipCanvas.height = Math.ceil(drawHeight * srcPixelsPerMm);
            const ctx = clipCanvas.getContext("2d")!;
            ctx.drawImage(blockCanvas, 0, Math.floor(drawn * srcPixelsPerMm), clipCanvas.width, clipCanvas.height, 0, 0, clipCanvas.width, clipCanvas.height);
            pdf.addImage(clipCanvas.toDataURL("image/jpeg", 0.95), "JPEG", margin, yOffset, totalImgWidth, drawHeight);
            drawn += drawHeight;
            yOffset = margin + drawHeight;
          }
        } else {
          pdf.addImage(
            blockCanvas.toDataURL("image/jpeg", 0.95),
            "JPEG", margin, yOffset, pageWidth - margin * 2, blockImgHeight
          );
          yOffset += blockImgHeight + 2;
        }
      }

      document.body.removeChild(container);
      pdf.save(`fortunefor-me-${new Date().toISOString().slice(0, 10)}.pdf`);
      // After successful download, ask about case study
      setTimeout(() => setCasePhase("consent"), 1000);
    } catch (e) {
      console.error("[pdf] Failed to generate:", e);
    } finally {
      setPdfGenerating(false);
    }
  }, [messages, getMasterInfo, t]);

  const handleCaseStudySubmit = useCallback(async () => {
    setCasePhase("processing");
    try {
      const userQuestion = messages.find((m) => m.role === "user")?.content || "";
      const res = await fetch("/api/case-studies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, question: userQuestion }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setCaseSummary(data.summary);
      setCasePhase("preview");
    } catch (e) {
      console.error("[case-study] Failed:", e);
      setCasePhase("idle");
    }
  }, [messages]);

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
                    <p className="text-xs text-stone/50">{t("comprehensive.chartGenFailed")}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Start discussion */}
        <section className="max-w-2xl mx-auto px-6 pb-12">
          <div className="border-t border-gold/10 pt-5 space-y-3">
            <label className="text-sm font-serif text-gold">{t("birth.topic")}</label>
            <input
              type="text"
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              placeholder="例：事業方向、感情發展、近期運勢..."
            />
            {/* Podcast mode toggle */}
                <div className="flex items-center gap-3 mt-3">
                  <button
                    type="button"
                    onClick={() => setPodcastMode(!podcastMode)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      podcastMode ? "bg-gold/40" : "bg-stone/20"
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-cream transition-transform ${
                      podcastMode ? "translate-x-5" : ""
                    }`} />
                  </button>
                  <div>
                    <span className="text-sm text-cream">{t("podcast.toggle")}</span>
                    <p className="text-[10px] text-stone/50">{t("podcast.toggleHint")}</p>
                  </div>
                </div>
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

          {/* TTS indicators moved to fixed floating bar — see below */}

        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg, i) => {
            if (msg.role === "user") {
              // Hide auto-discussion system prompts from the UI
              if (msg.content.startsWith("請針對前面其他老師")) return null;
              if (msg.content.startsWith("這是最後一輪")) return null;
              // Strip injected chart data from display (keep only the user's original text)
              const displayContent = msg.content.replace(/\n\n【(以下是|系統提示)[\s\S]*$/, "").trim();
              if (!displayContent) return null;
              return (
                <div key={i} className="flex justify-end">
                  <div className="bg-gold/8 border border-gold/15 rounded-lg px-4 py-3 max-w-[85%] text-sm text-cream/90 leading-relaxed">
                    <div className="whitespace-pre-wrap">{displayContent}</div>
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
                  <div
                    className="text-sm text-cream/90 leading-relaxed whitespace-pre-wrap prose-sm"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdown(msg.content)) }}
                  />
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

          {/* Thinking indicator — before content starts streaming */}
          {streamingMaster && !streamingContent && (
            <div className="flex justify-start">
              {(() => {
                const masterInfo = getMasterInfo(streamingMaster);
                return (
                  <div className={`border rounded-lg px-4 py-3 max-w-[90%] ${masterInfo?.bgClass || ""}`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className={`text-base ${masterInfo?.color}`}>{masterInfo?.symbol}</span>
                      <span className={`text-xs font-serif font-semibold ${masterInfo?.color}`}>{masterInfo?.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-stone/60">
                      <span className="inline-flex gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-gold/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-gold/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-gold/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                      <span className="text-xs animate-pulse">{t("comprehensive.thinking")}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

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
                    <div
                      className="text-sm text-cream/90 leading-relaxed whitespace-pre-wrap streaming-cursor prose-sm"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdown(streamingContent)) }}
                    />
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Floating TTS status bar — always visible at top */}
      {podcastMode && phase === "discussion" && (ttsGeneratingCount > 0 || audioQueue.isPlaying) && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-30 animate-fade-in-up" style={{ opacity: 0, animationDuration: "300ms", animationFillMode: "forwards" }}>
          <div className="px-4 py-2 rounded-full border border-gold/20 shadow-lg flex items-center gap-2.5" style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", background: "rgba(var(--glass-rgb), 0.06)" }}>
            {audioQueue.isPlaying && audioQueue.currentMaster ? (
              <>
                <svg className="w-3.5 h-3.5 animate-pulse text-gold" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                </svg>
                <span className={`text-xs font-serif ${getMasterInfo(audioQueue.currentMaster)?.color}`}>
                  {getMasterInfo(audioQueue.currentMaster)?.label}
                </span>
                <span className="text-[10px] text-stone/50">{t("podcast.playing")}</span>
              </>
            ) : (
              <>
                <span className="flex gap-0.5 items-end">
                  <span className="w-0.5 h-2 bg-gold/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-0.5 h-3 bg-gold/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-0.5 h-1.5 bg-gold/30 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  <span className="w-0.5 h-4 bg-gold/60 rounded-full animate-bounce" style={{ animationDelay: "100ms" }} />
                  <span className="w-0.5 h-2.5 bg-gold/40 rounded-full animate-bounce" style={{ animationDelay: "250ms" }} />
                </span>
                <span className="text-xs text-gold-dim">{t("podcast.generating")}...</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mobile FAB — collapsed state */}
      {!mobileControlsOpen && phase === "discussion" && (
        <button
          onClick={() => setMobileControlsOpen(true)}
          className="sm:hidden fixed bottom-6 right-4 z-30 w-12 h-12 rounded-full border border-gold/30 bg-[var(--parchment)] shadow-lg flex items-center justify-center text-gold/70 active:scale-95 transition-transform animate-fade-in-up"
          style={{ opacity: 0, animationDuration: "200ms", animationFillMode: "forwards" }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}

      {/* Bottom controls — hidden on mobile when collapsed */}
      <div
        className={`relative z-20 border-t border-gold/10 px-4 sm:px-6 py-4 shrink-0 ${
          !mobileControlsOpen && phase === "discussion" ? "hidden sm:block" : ""
        }`}
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
            {t("main.aiDisclaimer")}
          </p>

          {/* PDF Download — shown after discussion ends */}
          {discussionEnded && !loading && !isAutoDiscussing && (
            <button
              onClick={handleDownloadPdf}
              disabled={pdfGenerating}
              className="w-full mt-4 py-3 text-sm border border-gold/30 rounded-sm text-gold hover:bg-gold/15 transition-all duration-500 font-serif tracking-widest disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {pdfGenerating ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                  {t("comprehensive.generatingPdf")}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {t("comprehensive.downloadPdf")}
                </>
              )}
            </button>
          )}

          {/* Podcast download */}
          {discussionEnded && !loading && !isAutoDiscussing && podcastMode && audioQueue.hasSegments && (
            <button
              onClick={audioQueue.downloadPodcast}
              disabled={audioQueue.podcastDownloading}
              className="w-full mt-2 py-3 text-sm border border-violet-400/30 rounded-sm text-violet-400 hover:bg-violet-400/10 transition-all duration-500 font-serif tracking-widest flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {audioQueue.podcastDownloading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
                  {t("podcast.downloading")}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  {t("podcast.download")}
                </>
              )}
            </button>
          )}

          {/* Case study consent flow */}
          {casePhase === "consent" && (
            <div className="mt-4 p-4 rounded-lg border border-gold/20" style={{ backgroundColor: "rgba(var(--glass-rgb), 0.03)" }}>
              <p className="text-sm text-cream mb-3">{t("case.consent")}</p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setCasePhase("idle")}
                  className="px-4 py-2 text-xs text-stone hover:text-cream transition-colors"
                >
                  {t("case.consentNo")}
                </button>
                <button
                  onClick={handleCaseStudySubmit}
                  className="px-4 py-2 text-xs border border-gold/30 rounded-sm text-gold hover:bg-gold/15 transition-colors"
                >
                  {t("case.consentYes")}
                </button>
              </div>
            </div>
          )}

          {casePhase === "processing" && (
            <div className="mt-4 p-4 rounded-lg border border-gold/20 text-center" style={{ backgroundColor: "rgba(var(--glass-rgb), 0.03)" }}>
              <span className="inline-block w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin mr-2" />
              <span className="text-sm text-stone">{t("case.processing")}</span>
            </div>
          )}

          {casePhase === "preview" && (
            <div className="mt-4 p-4 rounded-lg border border-gold/20 space-y-3" style={{ backgroundColor: "rgba(var(--glass-rgb), 0.03)" }}>
              <p className="text-xs text-stone font-medium">{t("case.preview")}</p>
              <p className="text-sm text-cream leading-relaxed">{caseSummary}</p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setCasePhase("idle")}
                  className="px-4 py-2 text-xs text-stone hover:text-cream transition-colors"
                >
                  {t("case.cancelSubmit")}
                </button>
                <button
                  onClick={() => setCasePhase("done")}
                  className="px-4 py-2 text-xs border border-gold/30 rounded-sm text-gold hover:bg-gold/15 transition-colors"
                >
                  {t("case.confirmSubmit")}
                </button>
              </div>
            </div>
          )}

          {casePhase === "done" && (
            <div className="mt-4 p-4 rounded-lg border border-green-500/20 text-center" style={{ backgroundColor: "rgba(34,197,94,0.03)" }}>
              <p className="text-sm text-green-500">{t("case.thankYou")}</p>
            </div>
          )}

          <button
            onClick={() => setNewDiscussionConfirm(true)}
            className="w-full mt-3 py-2 text-xs text-stone/40 hover:text-stone/60 transition-colors tracking-wide"
          >
            {t("main.newDiscussion")}
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
