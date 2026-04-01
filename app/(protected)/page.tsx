"use client";

import { useState, useCallback, useRef, useEffect, type ChangeEvent } from "react";
import DivinationCard from "@/app/components/DivinationCard";
import InputForm, { type ChartRequest, timeToShichen } from "@/app/components/InputForm";
import ResultDisplay from "@/app/components/ResultDisplay";
import SavedConversations from "@/app/components/SavedConversations";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import SmokeParticles from "@/app/components/SmokeParticles";
import ThemeToggle from "@/app/components/ThemeToggle";
import UserMenu from "@/app/components/UserMenu";
import ZiweiChart from "@/app/components/ZiweiChart";
import MentionDropdown from "@/app/components/MentionDropdown";
import SavedCharts from "@/app/components/SavedCharts";

type DivinationType = "bazi" | "ziwei" | "zodiac";

type ZiweiBirthInfo = {
  birthday: string;
  birthTime: number;
  gender: "男" | "女";
  birthdayType: "lunar" | "solar";
};

type Message = {
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  images?: string[];
};

type Profile = {
  id: string;
  label: string;
  birthDate: string;
  birthTime: string;
  gender: string;
  birthPlace: string;
  calendarType: string;
  isLeapMonth: boolean;
  savedCharts?: {
    bazi?: string;
    ziwei?: string;
    zodiac?: string;
  };
};

type ConversationState = {
  messages: Message[];
  streamingContent: string;
  streamingReasoning: string;
  streaming: boolean;
  loading: boolean;
  ziweiBirthInfo?: ZiweiBirthInfo;
  chartData?: string;
  profileId?: string;
  profileLabel?: string;
};

type ChartPreview = {
  chart: string;
  request: ChartRequest;
  ziweiBirthInfo?: ZiweiBirthInfo;
};

const emptyConversation: ConversationState = {
  messages: [],
  streamingContent: "",
  streamingReasoning: "",
  streaming: false,
  loading: false,
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
  const [followUp, setFollowUp] = useState("");
  const [followUpImages, setFollowUpImages] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const followUpFileRef = useRef<HTMLInputElement>(null);

  // Track current type in a ref so streaming callbacks always see latest value
  const selectedTypeRef = useRef(selectedType);
  selectedTypeRef.current = selectedType;

  // Per-scene conversation state persisted across tab switches
  const conversationsRef = useRef<Record<DivinationType, ConversationState>>({
    bazi: { ...emptyConversation },
    ziwei: { ...emptyConversation },
    zodiac: { ...emptyConversation },
  });

  // Current conversation derived from selected type
  const [conv, setConv] = useState<ConversationState>(emptyConversation);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeTab, setActiveTab] = useState<"input" | "saved" | "charts">("input");
  const [newDiscussionConfirm, setNewDiscussionConfirm] = useState(false);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<number>>(new Set());
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [chartSaved, setChartSaved] = useState(false);
  const [chartPreview, setChartPreview] = useState<ChartPreview | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("我的命運");

  // Sync conversation state when switching types
  useEffect(() => {
    if (selectedType) {
      setConv({ ...conversationsRef.current[selectedType] });
      setFollowUp("");
      setFollowUpImages([]);
      setSavedMessageIds(new Set());
      setChartSaved(false);
      setChartPreview(null);
      setAiQuestion("我的命運");
      setActiveTab("input");
    }
  }, [selectedType]);

  const loadProfiles = useCallback(async () => {
    try {
      const res = await fetch("/api/profiles");
      const data = await res.json();
      setProfiles(data.profiles || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadProfiles();
    const handleProfilesUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (Array.isArray(detail)) {
        // Use profiles data directly from the event to avoid CDN cache staleness
        setProfiles(detail);
      } else {
        loadProfiles();
      }
    };
    window.addEventListener("profiles-updated", handleProfilesUpdated);
    return () => window.removeEventListener("profiles-updated", handleProfilesUpdated);
  }, [loadProfiles]);

  const conversationStarted = conv.messages.length > 0 || conv.streaming;

  // Track whether user is near the bottom of the scroll area
  const isNearBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 80;
  }, []);

  // Auto-scroll only when user is near the bottom
  useEffect(() => {
    if (scrollRef.current && isNearBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conv.streamingContent, conv.streamingReasoning, conv.messages.length]);

  const streamResponse = useCallback(
    async (
      type: DivinationType,
      chatMessages: { role: string; content: string; images?: string[] }[]
    ) => {
      // Set loading/streaming for this type
      const setTypeConv = (updater: (prev: ConversationState) => ConversationState) => {
        // Always update the ref
        conversationsRef.current[type] = updater(conversationsRef.current[type]);
        // Only update state if this type is still selected
        setConv((prev) => {
          // Check if we're still viewing this type
          // We use the ref to get the latest selectedType
          return updater(prev);
        });
      };

      setTypeConv((c) => ({
        ...c,
        loading: true,
        streamingContent: "",
        streamingReasoning: "",
        streaming: true,
      }));

      try {
        const response = await fetch("/api/divine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, messages: chatMessages }),
        });

        if (!response.ok) {
          const error = await response.json();
          const errorMsg: Message = {
            role: "assistant",
            content: `錯誤：${error.error || "請求失敗"}`,
          };
          conversationsRef.current[type] = {
            ...conversationsRef.current[type],
            messages: [...conversationsRef.current[type].messages, errorMsg],
            loading: false,
            streaming: false,
          };
          setConv((prev) => {
            if (selectedTypeRef.current === type) return { ...conversationsRef.current[type] };
            return prev;
          });
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
              }
              if (parsed.reasoning) {
                fullReasoning += parsed.reasoning;
              }
              if (parsed.chartData) {
                conversationsRef.current[type] = {
                  ...conversationsRef.current[type],
                  chartData: parsed.chartData,
                };
              }
            } catch {
              // skip
            }
          }

          // Update streaming content in ref always
          conversationsRef.current[type] = {
            ...conversationsRef.current[type],
            streamingContent: fullContent,
            streamingReasoning: fullReasoning,
          };
          // Update state only if viewing this type
          setConv((prev) => {
            if (selectedTypeRef.current === type) {
              return {
                ...prev,
                streamingContent: fullContent,
                streamingReasoning: fullReasoning,
                // Sync chartData from ref (emitted before AI stream starts)
                chartData: conversationsRef.current[type].chartData,
              };
            }
            return prev;
          });
        }

        const assistantMsg: Message = {
          role: "assistant",
          content: fullContent,
          reasoning: fullReasoning,
        };
        conversationsRef.current[type] = {
          ...conversationsRef.current[type],
          messages: [...conversationsRef.current[type].messages, assistantMsg],
          streamingContent: "",
          streamingReasoning: "",
          loading: false,
          streaming: false,
        };
        setConv((prev) => {
          if (selectedTypeRef.current === type) return { ...conversationsRef.current[type] };
          return prev;
        });
      } catch (err) {
        // If we already received partial content, preserve it instead of showing an error
        // This handles mobile background tab suspension breaking the SSE connection
        const partialContent = conversationsRef.current[type].streamingContent;
        const partialReasoning = conversationsRef.current[type].streamingReasoning;

        const assistantMsg: Message = partialContent
          ? {
              role: "assistant",
              content: partialContent + "\n\n---\n*（連線中斷，以上為已接收的部分回應。可透過追問繼續。）*",
              reasoning: partialReasoning,
            }
          : {
              role: "assistant",
              content: `連線錯誤：${err instanceof Error ? err.message : "未知錯誤"}`,
            };

        conversationsRef.current[type] = {
          ...conversationsRef.current[type],
          messages: [...conversationsRef.current[type].messages, assistantMsg],
          streamingContent: "",
          streamingReasoning: "",
          loading: false,
          streaming: false,
        };
        setConv((prev) => {
          if (selectedTypeRef.current === type) return { ...conversationsRef.current[type] };
          return prev;
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Step 1: Generate chart only (no AI yet)
  const handleGenerateChart = useCallback(
    async (request: ChartRequest) => {
      if (!selectedType) return;
      setChartLoading(true);
      try {
        const res = await fetch("/api/chart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: request.type,
            birthDate: request.birthDate,
            birthTime: request.birthTime,
            gender: request.gender,
            birthPlace: request.birthPlace,
            isLunar: request.calendarType === "lunar",
            isLeapMonth: request.isLeapMonth,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          alert(err.error || "命盤生成失敗");
          return;
        }
        const { chart } = await res.json();

        // Parse ziwei birth info for visual chart
        let ziweiBirthInfo: ZiweiBirthInfo | undefined;
        if (request.type === "ziwei") {
          const [h] = request.birthTime.split(":").map(Number);
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
          ziweiBirthInfo = {
            birthday: request.birthDate,
            birthTime: timeIdx,
            gender: request.gender === "女" ? "女" : "男",
            birthdayType: request.calendarType === "lunar" ? "lunar" : "solar",
          };
        }

        setChartPreview({ chart, request, ziweiBirthInfo });
        setAiQuestion("我的命運");
      } finally {
        setChartLoading(false);
      }
    },
    [selectedType]
  );

  // Step 2: Start AI conversation with the previewed chart
  const handleStartAiConversation = useCallback(
    async () => {
      if (!selectedType || !chartPreview) return;
      isNearBottomRef.current = true;
      const type = selectedType;
      const { chart, request, ziweiBirthInfo } = chartPreview;

      const isChineseType = type === "bazi" || type === "ziwei";
      const shichen = isChineseType ? timeToShichen(request.birthTime) : "";
      const calendarLabel = request.calendarType === "lunar"
        ? `農曆${request.isLeapMonth ? "（閏月）" : ""}`
        : "國曆";

      let userMessage: string;
      if (type === "bazi" || type === "ziwei") {
        userMessage = `出生日期：${request.birthDate}（${calendarLabel}）
出生時間：${request.birthTime}${shichen ? `（${shichen}）` : ""}
出生地點：${request.birthPlace}
性別：${request.gender || "未提供"}
特別想了解的方向：${aiQuestion}`;
      } else {
        userMessage = `出生日期：${request.birthDate}
出生時間：${request.birthTime}
出生地點：${request.birthPlace}
特別想了解的方向：${aiQuestion}`;
      }

      const userMsg: Message = { role: "user", content: userMessage };

      conversationsRef.current[type] = {
        ...conversationsRef.current[type],
        messages: [userMsg],
        ziweiBirthInfo,
        chartData: chart,
        profileId: request.profileId,
        profileLabel: request.profileLabel,
      };
      setConv((prev) => ({
        ...prev,
        messages: [userMsg],
        ziweiBirthInfo,
        chartData: chart,
        profileId: request.profileId,
        profileLabel: request.profileLabel,
      }));
      setChartPreview(null);

      await streamResponse(type, [
        { role: "user", content: userMessage },
      ]);
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    [selectedType, chartPreview, aiQuestion, streamResponse]
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

  // @ mention handling
  const handleFollowUpChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setFollowUp(val);

      // Detect @ trigger: find the last @ before cursor
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
    },
    []
  );

  const handleMentionSelect = useCallback(
    (label: string) => {
      // Replace the @query with @label in the text
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
      setMentionQuery("");

      // Refocus and set cursor after the inserted mention
      setTimeout(() => {
        textarea.focus();
        const newCursor = atIdx + label.length + 2; // @ + label + space
        textarea.setSelectionRange(newCursor, newCursor);
      }, 0);
    },
    [followUp]
  );

  // Build mention profiles list for the dropdown
  const mentionProfiles = profiles.map((p) => ({
    id: p.id,
    label: p.label,
    hasChart: !!p.savedCharts?.[selectedType as keyof NonNullable<Profile["savedCharts"]>],
  }));

  // Inject chart data for @mentions in the message
  const injectMentionCharts = useCallback(
    (message: string): string => {
      if (!selectedType) return message;
      const chartKey = selectedType as keyof NonNullable<Profile["savedCharts"]>;

      // Find all @mentions in the message
      const mentionRegex = /@(\S+)/g;
      let match;
      const injections: string[] = [];

      while ((match = mentionRegex.exec(message)) !== null) {
        const label = match[1];
        const profile = profiles.find((p) => p.label === label);
        if (!profile) continue;

        const chart = profile.savedCharts?.[chartKey];
        if (chart) {
          injections.push(
            `\n\n【以下是「${label}」由排盤程式精確計算的命盤數據，你必須完全依照這些數據進行解讀，不得自行排盤或編造任何數據】\n\n${chart}`
          );
        } else {
          injections.push(
            `\n\n【系統提示】使用者提到了「${label}」，但此人尚未在本場景生成並保存命盤。請提醒使用者先為「${label}」生成命盤後再進行分析。`
          );
        }
      }

      return message + injections.join("");
    },
    [selectedType, profiles]
  );

  const handleFollowUp = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if ((!followUp.trim() && followUpImages.length === 0) || conv.loading) return;
      if (!selectedType) return;
      isNearBottomRef.current = true;
      setMentionOpen(false);

      const type = selectedType;
      const userMsg = followUp.trim() || "請分析這張圖片";
      const msgWithCharts = injectMentionCharts(userMsg);
      const imgs = followUpImages.length > 0 ? [...followUpImages] : undefined;
      setFollowUp("");
      setFollowUpImages([]);

      const currentMessages = conversationsRef.current[type].messages;
      // Show original message (without chart injections) to the user
      const updatedMessages: Message[] = [
        ...currentMessages,
        { role: "user", content: userMsg, images: imgs },
      ];

      conversationsRef.current[type] = {
        ...conversationsRef.current[type],
        messages: updatedMessages,
      };
      setConv((prev) => ({
        ...prev,
        messages: updatedMessages,
      }));

      // Send message with chart injections to the API
      const apiMessages = updatedMessages.map((m, i) => ({
        role: m.role,
        content: i === updatedMessages.length - 1 ? msgWithCharts : m.content,
        images: m.images,
      }));

      await streamResponse(type, apiMessages);
    },
    [followUp, followUpImages, conv.loading, selectedType, streamResponse, injectMentionCharts]
  );

  const handleReset = useCallback(() => {
    if (selectedType) {
      conversationsRef.current[selectedType] = { ...emptyConversation };
    }
    setConv({ ...emptyConversation });
    setSelectedType(null);
    setFollowUp("");
    setFollowUpImages([]);
  }, [selectedType]);

  const handleSaveConversation = useCallback(
    async (messageIndex: number) => {
      if (!selectedType) return;
      const messages = conversationsRef.current[selectedType].messages;
      const aiMsg = messages[messageIndex];
      if (!aiMsg || aiMsg.role !== "assistant") return;

      let userQuestion = "";
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          userQuestion = messages[i].content;
          break;
        }
      }

      const profileLabel = conversationsRef.current[selectedType].profileLabel;

      await fetch("/api/saved-conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          userQuestion,
          aiResponse: aiMsg.content,
          aiReasoning: aiMsg.reasoning,
          profileLabel,
        }),
      });

      setSavedMessageIds((prev) => new Set(prev).add(messageIndex));
      window.dispatchEvent(new Event("conversation-saved"));
    },
    [selectedType]
  );

  const handleNewDiscussion = useCallback(() => {
    if (!selectedType) return;
    conversationsRef.current[selectedType] = { ...emptyConversation };
    setConv({ ...emptyConversation });
    setSavedMessageIds(new Set());
    setChartSaved(false);
    setChartPreview(null);
    setAiQuestion("我的命運");
    setNewDiscussionConfirm(false);
    setActiveTab("input");
  }, [selectedType]);

  const handleSaveChart = useCallback(
    async () => {
      if (!selectedType) return;
      const { chartData, profileId } = conversationsRef.current[selectedType];
      if (!chartData || !profileId) return;

      const newSavedCharts = {
        ...profiles.find((p) => p.id === profileId)?.savedCharts,
        [selectedType]: chartData,
      };

      const res = await fetch(`/api/profiles/${profileId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savedCharts: newSavedCharts }),
      });
      if (res.ok) {
        setChartSaved(true);
        // Update profiles state directly instead of re-fetching from Blob
        // (avoids CDN cache returning stale data)
        setProfiles((prev) =>
          prev.map((p) =>
            p.id === profileId ? { ...p, savedCharts: newSavedCharts } : p
          )
        );
      }
    },
    [selectedType, profiles]
  );

  // Switch to a type (from conversation mode back button → go to selection)
  const handleBackToSelection = useCallback(() => {
    setSelectedType(null);
    setFollowUp("");
    setFollowUpImages([]);
  }, []);

  // Check if any type has an active conversation
  const typesWithConversation = DIVINATION_TYPES.filter(
    (dt) =>
      conversationsRef.current[dt.id].messages.length > 0 ||
      conversationsRef.current[dt.id].streaming
  );

  // ── Conversation mode ──
  if (selectedType && conversationStarted) {
    return (
      <main className="relative z-10 flex flex-col h-dvh">
        <SmokeParticles />

        {/* Top bar */}
        <div className="relative z-20 flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <button
            onClick={handleBackToSelection}
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
            返回選擇
          </button>

          <h1 className="absolute left-1/2 -translate-x-1/2 text-xl font-bold tracking-[0.15em] text-gold" style={{ fontFamily: "var(--font-calligraphy)" }}>
            天機
          </h1>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>

        {/* Scene tabs — show when multiple scenes have conversations */}
        <div className="flex justify-center gap-2 px-4 pb-1 shrink-0">
          {DIVINATION_TYPES.map((dt) => {
            const hasConvo =
              conversationsRef.current[dt.id].messages.length > 0 ||
              conversationsRef.current[dt.id].streaming;
            if (!hasConvo && dt.id !== selectedType) return null;
            const isActive = dt.id === selectedType;
            const isStreaming = conversationsRef.current[dt.id].streaming;
            return (
              <button
                key={dt.id}
                onClick={() => setSelectedType(dt.id)}
                className={`
                  px-3 py-1.5 rounded-full text-xs font-serif tracking-wide transition-all duration-200
                  ${
                    isActive
                      ? "bg-gold/15 text-gold border border-gold/30"
                      : "text-stone/60 border border-transparent hover:text-stone hover:border-gold/15"
                  }
                `}
              >
                {dt.symbol} {dt.title}
                {isStreaming && !isActive && (
                  <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* Divination type indicator */}
        <div className="text-center pb-2 shrink-0">
          <div className="mx-auto mt-1 w-24 gold-line" />
        </div>

        {/* Messages area — scrollable */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4"
        >
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Visual ziwei chart */}
            {selectedType === "ziwei" && conv.ziweiBirthInfo && (
              <ZiweiChart
                birthday={conv.ziweiBirthInfo.birthday}
                birthTime={conv.ziweiBirthInfo.birthTime}
                gender={conv.ziweiBirthInfo.gender}
                birthdayType={conv.ziweiBirthInfo.birthdayType}
              />
            )}
            {conv.messages.map((msg, i) =>
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
                    onSave={() => handleSaveConversation(i)}
                    isSaved={savedMessageIds.has(i)}
                  />
                </div>
              )
            )}

            {/* Currently streaming */}
            {conv.streaming && (
              <div>
                <ResultDisplay
                  content={conv.streamingContent}
                  reasoning={conv.streamingReasoning}
                  streaming
                  hideDisclaimer
                />
              </div>
            )}

            {/* Save chart button */}
            {!conv.streaming && conv.chartData && conv.profileId && (
              <div className="flex justify-center py-2">
                {chartSaved ? (
                  <span className="text-xs text-gold-dim/50 flex items-center gap-1.5 px-3 py-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    命盤已保存至「{conv.profileLabel}」
                  </span>
                ) : (
                  <button
                    onClick={handleSaveChart}
                    className="text-xs text-gold-dim/60 hover:text-gold-dim transition-colors flex items-center gap-1.5 px-3 py-1.5 border border-gold/10 rounded-full"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    保存命盤至「{conv.profileLabel}」
                  </button>
                )}
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
                disabled={conv.loading}
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
              <div className="relative flex-1">
                {/* @ Mention Dropdown */}
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
                    // If mention dropdown is open, don't submit on Enter
                    if (mentionOpen) return;
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      if (followUp.trim() || followUpImages.length > 0) {
                        e.currentTarget.form?.requestSubmit();
                      }
                    }
                  }}
                  placeholder="繼續追問... 輸入 @ 可引用已保存的命盤"
                  disabled={conv.loading}
                  rows={5}
                  className="flex-1 w-full resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={
                  conv.loading ||
                  (!followUp.trim() && followUpImages.length === 0)
                }
                className={`
                  px-5 py-2.5 rounded-sm text-sm tracking-widest font-serif transition-all duration-500
                  border border-gold/20
                  ${
                    conv.loading ||
                    (!followUp.trim() && followUpImages.length === 0)
                      ? "text-gold-dim/50 cursor-not-allowed"
                      : "text-gold hover:bg-gold/15 active:scale-[0.98]"
                  }
                `}
              >
                {conv.loading ? (
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
          className="animate-fade-in-up text-5xl sm:text-6xl font-bold tracking-[0.15em] text-gold"
          style={{ fontFamily: "var(--font-calligraphy)", opacity: 0 }}
        >
          天機
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

      {/* Resume conversations */}
      {typesWithConversation.length > 0 && (
        <section className="max-w-2xl mx-auto px-6 pb-6">
          <p className="text-center text-sm text-mist/60 mb-3 tracking-wide">
            進行中的對話
          </p>
          <div className="flex justify-center gap-3">
            {typesWithConversation.map((dt) => {
              const isStreaming = conversationsRef.current[dt.id].streaming;
              return (
                <button
                  key={dt.id}
                  onClick={() => setSelectedType(dt.id)}
                  className="px-4 py-2.5 rounded-lg border border-gold/20 bg-gold/[0.04] hover:bg-gold/10 transition-colors flex items-center gap-2"
                >
                  <span className="text-lg">{dt.symbol}</span>
                  <span className="text-sm font-serif text-gold tracking-wide">
                    {dt.title}
                  </span>
                  {isStreaming && (
                    <span className="inline-block w-2 h-2 rounded-full bg-gold animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Divination Type Selection */}
      <section className="max-w-5xl mx-auto px-6 pb-8">
        <p
          className="animate-fade-in-up text-center text-sm text-mist/60 mb-6 sm:mb-8 tracking-wide"
          style={{ animationDelay: "500ms", opacity: 0 }}
        >
          選擇命理方式
        </p>

        {/* Mobile: Compact horizontal tabs */}
        <div
          className="animate-fade-in-up flex sm:hidden gap-2"
          style={{ animationDelay: "600ms", opacity: 0 }}
        >
          {DIVINATION_TYPES.map((dt) => (
            <button
              key={dt.id}
              onClick={() => setSelectedType(dt.id)}
              className={`
                flex-1 py-3 rounded-sm border text-center transition-all duration-300
                ${
                  selectedType === dt.id
                    ? "border-gold/60 bg-gold/[0.06]"
                    : "border-gold/10 active:border-gold/30"
                }
              `}
              style={
                selectedType !== dt.id
                  ? { backgroundColor: "rgba(var(--glass-rgb), 0.02)" }
                  : undefined
              }
            >
              <span
                className={`text-2xl block transition-opacity duration-300 ${
                  selectedType === dt.id ? "opacity-100" : "opacity-40"
                }`}
              >
                {dt.symbol}
              </span>
              <span
                className={`text-xs block mt-1 font-serif tracking-wide transition-colors duration-300 ${
                  selectedType === dt.id ? "text-gold" : "text-cream/70"
                }`}
              >
                {dt.title}
              </span>
            </button>
          ))}
        </div>

        {/* Mobile: Selected type description */}
        {selectedType && !conversationStarted && (
          <p className="sm:hidden text-center text-sm text-mist/60 mt-4 px-2 leading-relaxed">
            {DIVINATION_TYPES.find((d) => d.id === selectedType)?.description}
          </p>
        )}

        {/* Desktop: Full cards */}
        <div className="hidden sm:grid sm:grid-cols-3 gap-5">
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

      {/* Input Form / Saved Conversations Tabs */}
      {selectedType && !conversationStarted && (
        <section className="max-w-2xl mx-auto px-6 pb-8">
          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-gold/10">
            <button
              onClick={() => setActiveTab("input")}
              className={`px-4 py-2.5 text-sm font-serif tracking-wide transition-colors border-b-2 -mb-px ${
                activeTab === "input"
                  ? "border-gold text-gold"
                  : "border-transparent text-stone/50 hover:text-stone"
              }`}
            >
              輸入資料
            </button>
            <button
              onClick={() => setActiveTab("saved")}
              className={`px-4 py-2.5 text-sm font-serif tracking-wide transition-colors border-b-2 -mb-px ${
                activeTab === "saved"
                  ? "border-gold text-gold"
                  : "border-transparent text-stone/50 hover:text-stone"
              }`}
            >
              已保存對話
            </button>
            <button
              onClick={() => setActiveTab("charts")}
              className={`px-4 py-2.5 text-sm font-serif tracking-wide transition-colors border-b-2 -mb-px ${
                activeTab === "charts"
                  ? "border-gold text-gold"
                  : "border-transparent text-stone/50 hover:text-stone"
              }`}
            >
              已保存命盤
            </button>
          </div>

          {activeTab === "input" ? (
            chartPreview ? (
              /* Chart Preview Stage */
              <div className="space-y-6 animate-fade-in-up" style={{ opacity: 0 }}>
                <div className="gold-line mb-4" />

                {/* Ziwei visual chart */}
                {selectedType === "ziwei" && chartPreview.ziweiBirthInfo && (
                  <ZiweiChart
                    birthday={chartPreview.ziweiBirthInfo.birthday}
                    birthTime={chartPreview.ziweiBirthInfo.birthTime}
                    gender={chartPreview.ziweiBirthInfo.gender}
                    birthdayType={chartPreview.ziweiBirthInfo.birthdayType}
                  />
                )}

                {/* Chart data display */}
                <div className="border border-gold/10 rounded-lg p-4" style={{ background: "rgba(var(--glass-rgb), 0.02)" }}>
                  <h3 className="text-sm font-serif text-gold mb-3">命盤數據</h3>
                  <pre className="text-xs text-stone/70 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {chartPreview.chart.replace(/<[^>]+>/g, "").trim()}
                  </pre>
                </div>

                {/* Save chart to profile */}
                {chartPreview.request.profileId && (
                  <div className="flex justify-center">
                    {chartSaved ? (
                      <span className="text-xs text-gold-dim/50 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        命盤已保存至「{chartPreview.request.profileLabel}」
                      </span>
                    ) : (
                      <button
                        onClick={async () => {
                          const req = chartPreview.request;
                          if (!req.profileId) return;
                          const newSavedCharts = {
                            ...profiles.find((p) => p.id === req.profileId)?.savedCharts,
                            [selectedType]: chartPreview.chart,
                          };
                          const res = await fetch(`/api/profiles/${req.profileId}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ savedCharts: newSavedCharts }),
                          });
                          if (res.ok) {
                            setChartSaved(true);
                            setProfiles((prev) =>
                              prev.map((p) =>
                                p.id === req.profileId ? { ...p, savedCharts: newSavedCharts } : p
                              )
                            );
                          }
                        }}
                        className="text-xs text-gold-dim/60 hover:text-gold-dim transition-colors flex items-center gap-1.5 px-3 py-1.5 border border-gold/10 rounded-full"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        保存命盤至「{chartPreview.request.profileLabel}」
                      </button>
                    )}
                  </div>
                )}

                {/* AI question input */}
                <div className="border-t border-gold/10 pt-5 space-y-3">
                  <label className="text-sm font-serif text-gold">想了解的方向</label>
                  <input
                    type="text"
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    placeholder="例：近期事業運、感情發展、健康狀況..."
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setChartPreview(null); setChartSaved(false); }}
                      className="flex-1 py-3 rounded-sm text-sm text-stone border border-gold/10 hover:bg-gold/5 transition-colors font-serif tracking-widest"
                    >
                      返回修改
                    </button>
                    <button
                      onClick={handleStartAiConversation}
                      disabled={!aiQuestion.trim()}
                      className="flex-1 py-3 rounded-sm text-sm text-gold border border-gold/20 bg-gold/15 hover:bg-gold/25 transition-colors font-serif tracking-widest disabled:opacity-40"
                    >
                      開始 AI 分析
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <InputForm
                type={selectedType}
                onSubmit={handleGenerateChart}
                loading={chartLoading}
                profiles={profiles}
                onProfilesChange={loadProfiles}
              />
            )
          ) : activeTab === "saved" ? (
            <SavedConversations type={selectedType} />
          ) : (
            <SavedCharts type={selectedType} profiles={profiles} />
          )}
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
