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
import ComprehensiveMode from "@/app/components/ComprehensiveMode";
import FeedbackModal from "@/app/components/FeedbackModal";
import SiteFooter from "@/app/components/SiteFooter";
import { useLocale } from "@/app/components/LocaleProvider";
import LocaleSwitcher from "@/app/components/LocaleSwitcher";
import FeaturesGuideButton from "@/app/components/FeaturesGuideButton";
import { useQuotaExhausted } from "@/app/components/QuotaExhaustedGate";
import { callDivine } from "@/app/lib/divine-fetch";

type DivinationType = "bazi" | "ziwei" | "zodiac" | "comprehensive";

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

const DIVINATION_TYPE_IDS: { id: DivinationType; symbol: string }[] = [
  { id: "bazi", symbol: "乾" },
  { id: "ziwei", symbol: "紫" },
  { id: "zodiac", symbol: "☿" },
  { id: "comprehensive", symbol: "道" },
];

export default function Home() {
  const { locale, t } = useLocale();
  const { trigger: triggerQuotaExhausted } = useQuotaExhausted();
  const DIVINATION_TYPES = DIVINATION_TYPE_IDS.map(({ id, symbol }) => ({
    id,
    symbol,
    title: t(`type.${id}`),
    subtitle: t(`type.${id}.subtitle`),
    description: t(`type.${id}.desc`),
  }));
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
  const conversationsRef = useRef<Record<string, ConversationState>>({
    bazi: { ...emptyConversation },
    ziwei: { ...emptyConversation },
    zodiac: { ...emptyConversation },
    comprehensive: { ...emptyConversation },
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
  const [aiQuestion, setAiQuestion] = useState(t("main.defaultQuestion"));
  const [reasoningDepth, setReasoningDepth] = useState("high");
  const reasoningDepthRef = useRef(reasoningDepth);
  reasoningDepthRef.current = reasoningDepth;

  const localeRef = useRef(locale);
  localeRef.current = locale;

  // Listen for reasoning depth changes from UserMenu
  useEffect(() => {
    const handler = (e: Event) => {
      const depth = (e as CustomEvent).detail;
      if (depth) setReasoningDepth(depth);
    };
    window.addEventListener("reasoning-depth-changed", handler);
    return () => window.removeEventListener("reasoning-depth-changed", handler);
  }, []);

  // Sync conversation state when switching types
  useEffect(() => {
    if (selectedType) {
      setConv({ ...conversationsRef.current[selectedType] });
      setFollowUp("");
      setFollowUpImages([]);
      setSavedMessageIds(new Set());
      setChartSaved(false);
      setChartPreview(null);
      setAiQuestion(t("main.defaultQuestion"));
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
  const [mobileControlsOpen, setMobileControlsOpen] = useState(true);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Track whether user is near the bottom of the scroll area
  const isNearBottomRef = useRef(true);

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

  // Auto-scroll only when user is near the bottom
  useEffect(() => {
    if (scrollRef.current && isNearBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conv.streamingContent, conv.streamingReasoning, conv.messages.length]);

  // Auto-collapse mobile controls when AI starts responding
  useEffect(() => {
    if (conv.loading && window.innerWidth < 640) {
      setMobileControlsOpen(false);
    }
  }, [conv.loading]);

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
        const response = await callDivine(
          "/api/divine",
          { type, messages: chatMessages, reasoningDepth: reasoningDepthRef.current, locale: localeRef.current },
          triggerQuotaExhausted
        );

        if (response.status === 402) {
          // Quota exhausted — QuotaExhaustedGate is showing the modal.
          // Clear loading/streaming state so the UI doesn't hang.
          conversationsRef.current[type] = {
            ...conversationsRef.current[type],
            loading: false,
            streaming: false,
          };
          setConv((prev) => {
            if (selectedTypeRef.current === type) return { ...conversationsRef.current[type] };
            return prev;
          });
          return;
        }

        if (!response.ok) {
          const error = await response.json();
          const errorMsg: Message = {
            role: "assistant",
            content: `${t("error.prefix")}：${error.error || "Request failed"}`,
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

        // Auto-save the latest user question + AI response so the user can
        // come back to it later if they close the tab before finishing.
        // Rotates to keep only the 3 most recent auto rows per (user, type).
        // Content is AES-256-GCM encrypted by the backend; admins/DBAs cannot
        // read it in plain text.
        (() => {
          const msgs = conversationsRef.current[type].messages;
          let lastUserQ = "";
          for (let i = msgs.length - 2; i >= 0; i--) {
            if (msgs[i].role === "user") {
              lastUserQ = msgs[i].content;
              break;
            }
          }
          if (!lastUserQ || !fullContent) return;
          fetch("/api/saved-conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type,
              userQuestion: lastUserQ,
              aiResponse: fullContent,
              aiReasoning: fullReasoning || undefined,
              profileLabel: conversationsRef.current[type].profileLabel,
              origin: "auto",
            }),
          }).catch(() => {
            // Auto-save failures are non-critical; user can still save manually.
          });
        })();
      } catch (err) {
        // If we already received partial content, preserve it instead of showing an error
        // This handles mobile background tab suspension breaking the SSE connection
        const partialContent = conversationsRef.current[type].streamingContent;
        const partialReasoning = conversationsRef.current[type].streamingReasoning;

        const assistantMsg: Message = partialContent
          ? {
              role: "assistant",
              content: partialContent + `\n\n---\n*${t("main.connectionInterrupted")}*`,
              reasoning: partialReasoning,
            }
          : {
              role: "assistant",
              content: `${t("main.connectionError")}：${err instanceof Error ? err.message : "Unknown error"}`,
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
          alert(err.error || t("main.chartGenFailed"));
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
        setAiQuestion(t("main.defaultQuestion"));
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
        ? `${t("comprehensive.lunar")}${request.isLeapMonth ? `（${t("form.leapMonth")}）` : ""}`
        : t("comprehensive.solar");

      let userMessage: string;
      if (type === "bazi" || type === "ziwei") {
        userMessage = `${t("birth.date")}：${request.birthDate}（${calendarLabel}）
${t("birth.time")}：${request.birthTime}${shichen ? `（${shichen}）` : ""}
${t("birth.place")}：${request.birthPlace}
${t("birth.gender")}：${request.gender || t("form.noGender")}
${t("birth.topic")}：${aiQuestion}`;
      } else {
        userMessage = `${t("birth.date")}：${request.birthDate}
${t("birth.time")}：${request.birthTime}
${t("birth.place")}：${request.birthPlace}
${t("birth.topic")}：${aiQuestion}`;
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

  // Start AI conversation directly from a saved chart
  const handleStartFromSavedChart = useCallback(
    (profile: Profile, chart: string) => {
      if (!selectedType || selectedType === "comprehensive") return;
      // Set up chart preview with the saved chart data, then let user enter question
      const request: ChartRequest = {
        type: selectedType,
        birthDate: profile.birthDate,
        birthTime: profile.birthTime,
        gender: profile.gender,
        birthPlace: profile.birthPlace,
        calendarType: profile.calendarType || "solar",
        isLeapMonth: profile.isLeapMonth || false,
        profileId: profile.id,
        profileLabel: profile.label,
      };

      let ziweiBirthInfo: ZiweiBirthInfo | undefined;
      if (selectedType === "ziwei") {
        const [h] = profile.birthTime.split(":").map(Number);
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
          birthday: profile.birthDate,
          birthTime: timeIdx,
          gender: profile.gender === "女" ? "女" : "男",
          birthdayType: (profile.calendarType || "solar") === "lunar" ? "lunar" : "solar",
        };
      }

      setChartPreview({ chart, request, ziweiBirthInfo });
      setChartSaved(true); // Already saved
      setAiQuestion(t("main.defaultQuestion"));
      setActiveTab("input");
    },
    [selectedType]
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
            `\n\n${t("main.chartInjection", { label })}\n\n${chart}`
          );
        } else {
          injections.push(
            `\n\n${t("main.chartNotSaved", { label })}`
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
      const userMsg = followUp.trim() || t("main.analyzeImage");
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
    setAiQuestion(t("main.defaultQuestion"));
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

  // ── Comprehensive mode (separate component) ──
  if (selectedType === "comprehensive") {
    return (
      <ComprehensiveMode
        profiles={profiles}
        onProfilesChange={loadProfiles}
        onBack={() => setSelectedType(null)}
        reasoningDepth={reasoningDepth}
      />
    );
  }

  // ── Conversation mode ──
  if (selectedType && conversationStarted) {
    return (
      <main className="relative z-10 flex flex-col h-dvh">
        <SmokeParticles />

        {/* Top bar */}
        <div className="relative z-20 flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <button
            onClick={handleBackToSelection}
            className="flex items-center gap-1.5 text-sm text-text-tertiary hover:text-text-secondary transition-colors min-h-[44px]"
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
            {t("main.backToSelect")}
          </button>

          <h1 className="absolute left-1/2 -translate-x-1/2 text-xl font-bold text-text-primary">
            {t("app.title")}
          </h1>

          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <FeaturesGuideButton />
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
                  px-3 py-1.5 rounded-full text-xs transition-all duration-200
                  ${
                    isActive
                      ? "bg-accent/[0.06] text-accent border border-accent/30"
                      : "text-text-tertiary border border-transparent hover:text-text-secondary hover:border-border-light"
                  }
                `}
              >
                {dt.symbol} {dt.title}
                {isStreaming && !isActive && (
                  <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* Divination type indicator */}
        <div className="text-center pb-2 shrink-0">
          <div className="mx-auto mt-1 w-24 tesla-divider" />
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
                  <div className="bg-accent/[0.04] border border-accent/20 rounded-lg px-4 py-3 max-w-[85%] text-sm text-text-primary leading-relaxed">
                    {msg.images && msg.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {msg.images.map((img, j) => (
                          <img
                            key={j}
                            src={img}
                            alt=""
                            className="w-24 h-24 object-cover rounded border border-border-light"
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
                  <span className="text-xs text-text-tertiary flex items-center gap-1.5 px-3 py-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t("main.chartSavedTo")}「{conv.profileLabel}」
                  </span>
                ) : (
                  <button
                    onClick={handleSaveChart}
                    className="text-xs text-accent hover:text-accent transition-colors flex items-center gap-1.5 px-3 py-1.5 border border-accent/20 rounded-full"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    {t("main.saveChartTo")}「{conv.profileLabel}」
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile FAB — collapsed state */}
        <button
          onClick={() => setMobileControlsOpen(true)}
          className={`sm:hidden fixed bottom-6 right-4 z-30 w-12 h-12 rounded-full bg-bg-primary shadow-lg flex items-center justify-center text-accent/70 active:scale-95 transition-all duration-300 ease-in-out ${
            mobileControlsOpen ? "opacity-0 scale-75 pointer-events-none" : "opacity-100 scale-100"
          }`}
        >
          <svg className="w-5 h-5 relative" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>

        {/* Follow-up input — slides down on mobile when collapsed, always visible on desktop */}
        <div
          className={`relative z-20 border-t border-border-light px-4 sm:px-6 py-4 shrink-0 transition-all duration-300 ease-in-out sm:!translate-y-0 sm:!opacity-100 sm:!pointer-events-auto sm:!max-h-none ${
            !mobileControlsOpen
              ? "max-sm:translate-y-full max-sm:opacity-0 max-sm:pointer-events-none max-sm:max-h-0 max-sm:py-0 max-sm:overflow-hidden"
              : ""
          }`}
          style={{ background: "var(--bg-primary)" }}
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
                      className="w-16 h-16 object-cover rounded border border-border-light"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFollowUpImages((prev) =>
                          prev.filter((_, j) => j !== i)
                        )
                      }
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
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
                className="shrink-0 w-[44px] h-[44px] flex items-center justify-center rounded-sm border border-border-light text-text-tertiary hover:text-text-secondary hover:border-border-subtle transition-colors disabled:opacity-40"
                title={t("main.uploadImage")}
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
                  placeholder={t("main.followUpPlaceholder")}
                  disabled={conv.loading}
                  rows={2}
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
                  px-5 py-2.5 rounded-sm text-sm transition-all duration-500
                  ${
                    conv.loading ||
                    (!followUp.trim() && followUpImages.length === 0)
                      ? "bg-accent/50 text-white cursor-not-allowed"
                      : "bg-accent text-white hover:bg-accent/90 active:scale-[0.98]"
                  }
                `}
              >
                {conv.loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  t("main.send")
                )}
              </button>
            </form>
            <p className="text-center text-xs text-text-placeholder mt-2">
              {t("main.aiDisclaimer")}
              {" · "}
              <a href="/terms" className="hover:text-accent transition-colors underline-offset-2 hover:underline">
                {t("footer.terms")}
              </a>
              {" · "}
              <button
                type="button"
                onClick={() => setFeedbackOpen(true)}
                className="hover:text-accent transition-colors underline-offset-2 hover:underline"
              >
                {t("footer.feedback")}
              </button>
            </p>
            <button
              onClick={() => setNewDiscussionConfirm(true)}
              className="w-full mt-3 py-2 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
            >
              {t("main.newDiscussion")}
            </button>
          </div>
        </div>

        <ConfirmDialog
          open={newDiscussionConfirm}
          title={t("main.newDiscussion")}
          message={t("main.newDiscussionConfirm")}
          confirmLabel={t("main.confirm")}
          onConfirm={handleNewDiscussion}
          onCancel={() => setNewDiscussionConfirm(false)}
        />
        <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      </main>
    );
  }

  // ── Initial selection mode ──
  return (
    <main className="relative z-10 flex-1">
      <SmokeParticles />

      {/* Top bar */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <LocaleSwitcher />
        <FeaturesGuideButton />
        <ThemeToggle />
        <UserMenu />
      </div>

      {/* Header */}
      <header className="pt-16 pb-12 px-6 text-center">
        <h1
          className="animate-fade-in text-[40px] font-medium text-text-primary"
        >
          {t("app.title")}
        </h1>
        <p
          className="animate-fade-in mt-3 text-lg sm:text-xl text-text-tertiary"
        >
          {t("app.subtitle")}
        </p>
        <div
          className="animate-fade-in mx-auto mt-6 w-32 tesla-divider"
        />
      </header>

      {/* Resume conversations */}
      {typesWithConversation.length > 0 && (
        <section className="max-w-2xl mx-auto px-6 pb-6">
          <p className="text-center text-sm text-text-secondary mb-3">
            {t("main.currentConversation")}
          </p>
          <div className="flex justify-center gap-3">
            {typesWithConversation.map((dt) => {
              const isStreaming = conversationsRef.current[dt.id].streaming;
              return (
                <button
                  key={dt.id}
                  onClick={() => setSelectedType(dt.id)}
                  className="px-4 py-2.5 rounded-lg border border-accent/20 bg-accent/[0.04] hover:bg-accent/10 transition-colors flex items-center gap-2"
                >
                  <span className="text-lg">{dt.symbol}</span>
                  <span className="text-sm text-accent">
                    {dt.title}
                  </span>
                  {isStreaming && (
                    <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
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
          className="animate-fade-in text-center text-sm text-text-secondary mb-6 sm:mb-8"
        >
          {t("main.selectType")}
        </p>

        {/* Mobile: Compact horizontal tabs — basic types */}
        <div
          className="animate-fade-in flex sm:hidden gap-2"
        >
          {DIVINATION_TYPES.filter((dt) => dt.id !== "comprehensive").map((dt) => (
            <button
              key={dt.id}
              onClick={() => setSelectedType(dt.id)}
              className={`
                flex-1 py-3 rounded-sm border text-center transition-all duration-300
                ${
                  selectedType === dt.id
                    ? "border-accent/60 bg-accent/[0.06]"
                    : "border-border-light active:border-accent/30"
                }
              `}
            >
              <span
                className={`text-2xl block transition-opacity duration-300 ${
                  selectedType === dt.id ? "opacity-100" : "opacity-40"
                }`}
              >
                {dt.symbol}
              </span>
              <span
                className={`text-xs block mt-1 transition-colors duration-300 ${
                  selectedType === dt.id ? "text-accent" : "text-text-primary"
                }`}
              >
                {dt.title}
              </span>
            </button>
          ))}
        </div>

        {/* Mobile: Premium comprehensive button */}
        {(() => {
          const dt = DIVINATION_TYPES.find((d) => d.id === "comprehensive")!;
          const isActive = selectedType === ("comprehensive" as DivinationType);
          return (
            <div className="animate-fade-in sm:hidden mt-3">
              <div className="mx-auto w-3/4 h-px mb-3 tesla-divider" />
              <button
                onClick={() => setSelectedType("comprehensive")}
                className={`
                  w-full py-3 px-4 rounded-sm border text-center transition-all duration-300 flex items-center justify-center gap-2
                  ${isActive
                    ? "border-accent/60 bg-accent/[0.06]"
                    : "border-border-light active:border-accent/30"
                  }
                `}
              >
                <span className={`text-2xl transition-opacity duration-300 ${isActive ? "opacity-100" : "opacity-50"}`}>
                  {dt.symbol}
                </span>
                <span className={`text-xs transition-colors duration-300 ${isActive ? "text-accent" : "text-text-primary"}`}>
                  {dt.title}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 border border-accent/30 rounded-full text-accent/70 uppercase ml-1">
                  Premium
                </span>
              </button>
            </div>
          );
        })()}

        {/* Mobile: Selected type description */}
        {selectedType && !conversationStarted && (
          <p className="sm:hidden text-center text-sm text-text-secondary mt-4 px-2 leading-relaxed">
            {DIVINATION_TYPES.find((d) => d.id === selectedType)?.description}
          </p>
        )}

        {/* Desktop: Basic type cards */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {DIVINATION_TYPES.filter((dt) => dt.id !== "comprehensive").map((dt, i) => (
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

        {/* Gold divider */}
        <div
          className="hidden sm:block animate-fade-in my-8"
        >
          <div className="mx-auto w-full max-w-md tesla-divider" />
        </div>

        {/* Desktop: Premium comprehensive card */}
        {(() => {
          const dt = DIVINATION_TYPES.find((d) => d.id === "comprehensive")!;
          const isActive = selectedType === ("comprehensive" as DivinationType);
          return (
            <div
              className="hidden sm:block animate-fade-in max-w-2xl mx-auto"
            >
              <button
                onClick={() => setSelectedType("comprehensive")}
                className="w-full text-left group"
              >
                <div
                  className={`
                    relative overflow-hidden tesla-card-bordered
                    ${isActive
                      ? "!border-accent/60 !bg-accent/[0.08]"
                      : ""
                    }
                  `}
                >
                  <div className="p-6 sm:p-8 flex items-center gap-6">
                    <div className={`text-5xl transition-all duration-500 ${isActive ? "opacity-100" : "opacity-50 group-hover:opacity-70"}`}>
                      {dt.symbol}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className={`text-xl sm:text-2xl font-semibold transition-colors duration-300 ${isActive ? "text-accent" : "text-text-primary"}`}>
                          {dt.title}
                        </h3>
                        <span className="text-[10px] px-2 py-0.5 border border-accent/30 rounded-full text-accent/70 uppercase">
                          Premium
                        </span>
                      </div>
                      <p className="text-sm text-text-tertiary mb-2">{dt.subtitle}</p>
                      <p className="text-sm text-text-secondary leading-relaxed">{dt.description}</p>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          );
        })()}
      </section>

      {/* Input Form / Saved Conversations Tabs */}
      {selectedType && !conversationStarted && (
        <section className="max-w-2xl mx-auto px-6 pb-8">
          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-border-light">
            <button
              onClick={() => setActiveTab("input")}
              className={`px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px ${
                activeTab === "input"
                  ? "border-accent text-accent"
                  : "border-transparent text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {t("main.inputTab")}
            </button>
            <button
              onClick={() => setActiveTab("saved")}
              className={`px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px ${
                activeTab === "saved"
                  ? "border-accent text-accent"
                  : "border-transparent text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {t("main.savedConversations")}
            </button>
            <button
              onClick={() => setActiveTab("charts")}
              className={`px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px ${
                activeTab === "charts"
                  ? "border-accent text-accent"
                  : "border-transparent text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {t("main.savedCharts")}
            </button>
          </div>

          {activeTab === "input" ? (
            chartPreview ? (
              /* Chart Preview Stage */
              <div className="space-y-6 animate-fade-in">
                <div className="tesla-divider mb-4" />

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
                <div className="border border-border-light rounded-lg p-4">
                  <h3 className="text-sm text-accent mb-3">{t("main.chartData")}</h3>
                  <pre className="text-xs text-text-tertiary leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {chartPreview.chart.replace(/<[^>]+>/g, "").trim()}
                  </pre>
                </div>

                {/* Save chart to profile */}
                {chartPreview.request.profileId && (
                  <div className="flex justify-center">
                    {chartSaved ? (
                      <span className="text-xs text-text-tertiary flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {t("main.chartSavedTo")}「{chartPreview.request.profileLabel}」
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
                        className="text-xs text-accent hover:text-accent transition-colors flex items-center gap-1.5 px-3 py-1.5 border border-accent/20 rounded-full"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        {t("main.saveChartTo")}「{chartPreview.request.profileLabel}」
                      </button>
                    )}
                  </div>
                )}

                {/* AI question input */}
                <div className="border-t border-border-light pt-5 space-y-3">
                  <label className="text-sm text-accent">{t("main.questionDirection")}</label>
                  <input
                    type="text"
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    placeholder={t("main.questionPlaceholder")}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setChartPreview(null); setChartSaved(false); }}
                      className="flex-1 py-3 rounded text-sm text-text-secondary border border-border-light hover:bg-bg-secondary transition-colors"
                    >
                      {t("main.backToEdit")}
                    </button>
                    <button
                      onClick={handleStartAiConversation}
                      disabled={!aiQuestion.trim()}
                      className="flex-1 py-3 rounded text-sm bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-40"
                    >
                      {t("main.startAnalysis")}
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
            <SavedConversations type={selectedType as "bazi" | "ziwei" | "zodiac"} />
          ) : (
            <SavedCharts type={selectedType as "bazi" | "ziwei" | "zodiac"} profiles={profiles} onStartChat={handleStartFromSavedChart} />
          )}
        </section>
      )}

      <SiteFooter />
    </main>
  );
}
