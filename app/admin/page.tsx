"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { signOut } from "next-auth/react";
import SmokeParticles from "@/app/components/SmokeParticles";
import ThemeToggle from "@/app/components/ThemeToggle";
import SiteFooter from "@/app/components/SiteFooter";
import { useLocale } from "@/app/components/LocaleProvider";
import LocaleSwitcher from "@/app/components/LocaleSwitcher";
import PaymentsTab from "@/app/components/admin/PaymentsTab";

interface UserItem {
  email: string;
  name: string | null;
  username?: string | null;
  image: string | null;
  status: "pending" | "approved" | "disabled" | "unverified";
  createdAt: string;
  approvedAt: string | null;
  authProvider?: string;
  singleCredits?: number;
  multiCredits?: number;
  singleUsed?: number;
  multiUsed?: number;
  isAmbassador?: boolean;
  isFriend?: boolean;
}

// --- AI Settings types ---
interface ProviderInfo {
  label: string;
  defaultUrl: string;
  defaultModel: string;
}

interface MasterAIConfig {
  provider: string;
  modelId: string;
  apiKey: string;
  apiUrl: string;
  hasKey?: boolean;
  thinkingMode?: "adaptive" | "enabled" | "disabled";
  effort?: "low" | "medium" | "high" | "max";
  thinkingBudget?: number;
  reasoningDepth?: "high" | "medium" | "low" | "off";
}

// Claude models: useEffort means use adaptive+effort (4.6), otherwise use enabled+budget (legacy)
const CLAUDE_MODELS = [
  { id: "claude-opus-4-6", label: "Claude Opus 4.6", useEffort: true },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", useEffort: true },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", useEffort: false },
  { id: "claude-opus-4-5", label: "Claude Opus 4.5", useEffort: false },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", useEffort: false },
  { id: "claude-opus-4-1", label: "Claude Opus 4.1", useEffort: false },
  { id: "claude-sonnet-4-0", label: "Claude Sonnet 4", useEffort: false },
  { id: "claude-opus-4-0", label: "Claude Opus 4", useEffort: false },
];

type Tab = "users" | "ai" | "tts" | "usage" | "cases" | "feedback" | "payments";

interface FeedbackItem {
  id: number;
  name: string;
  email: string;
  userEmail: string | null;
  message: string;
  reply: string | null;
  repliedAt: string | null;
  repliedBy: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function AdminPage() {
  const { t } = useLocale();

  const STATUS_LABELS: Record<string, { text: string; color: string }> = useMemo(() => ({
    unverified: { text: t("admin.statusUnverified"), color: "text-orange-400" },
    pending: { text: t("admin.statusPending"), color: "text-yellow-500" },
    approved: { text: t("admin.statusApproved"), color: "text-green-500" },
    disabled: { text: t("admin.statusDisabled"), color: "text-red-400" },
  }), [t]);

  const PROVIDERS: Record<string, ProviderInfo> = useMemo(() => ({
    byteplus: {
      label: "BytePlus (Seed)",
      defaultUrl: "https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions",
      defaultModel: "seed-2-0-pro-260328",
    },
    openai: {
      label: "OpenAI",
      defaultUrl: "https://api.openai.com/v1/chat/completions",
      defaultModel: "gpt-4o",
    },
    anthropic: {
      label: "Anthropic (Claude)",
      defaultUrl: "https://api.anthropic.com/v1/messages",
      defaultModel: "claude-sonnet-4-0",
    },
    google: {
      label: "Google (Gemini)",
      defaultUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      defaultModel: "gemini-3-flash-preview",
    },
    custom: {
      label: t("admin.customProvider"),
      defaultUrl: "",
      defaultModel: "",
    },
  }), [t]);

  const MASTER_KEYS = useMemo(() => [
    { key: "bazi", label: t("master.bazi") },
    { key: "ziwei", label: t("master.ziwei") },
    { key: "zodiac", label: t("master.zodiac") },
  ], [t]);

  const EFFORT_OPTIONS = useMemo(() => [
    { value: "low", label: t("admin.effortLow") },
    { value: "medium", label: t("admin.effortMedium") },
    { value: "high", label: t("admin.effortHigh") },
  ], [t]);

  const BYTEPLUS_DEPTH_OPTIONS = useMemo(() => [
    { value: "high", label: t("admin.depthHigh") },
    { value: "medium", label: t("admin.depthMedium") },
    { value: "low", label: t("admin.depthLow") },
    { value: "off", label: t("admin.depthOff") },
  ], [t]);

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "ai" || tab === "tts" || tab === "usage" || tab === "cases" || tab === "feedback" || tab === "payments") {
        return tab;
      }
    }
    return "users";
  });

  // --- Users state ---
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [storageType, setStorageType] = useState<string>("");
  const [storageError, setStorageError] = useState<string>("");

  // --- Usage state ---
  const [usageRange, setUsageRange] = useState("1m");
  const [usageData, setUsageData] = useState<{
    summary: { totalCalls: number; totalInputTokens: number; totalOutputTokens: number };
    byUser: { email: string; name: string | null; image: string | null; calls: number; inputTokens: number; outputTokens: number; models: Record<string, number> }[];
    tts?: { calls: number; characters: number; models: string[] };
  } | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  // --- Credit grants audit log ---
  type CreditGrant = {
    id: number;
    senderEmail: string;
    recipientEmail: string;
    singleCredits: number;
    multiCredits: number;
    deliveryMode: "direct" | "pending";
    note: string | null;
    createdAt: string;
  };
  const [creditGrants, setCreditGrants] = useState<CreditGrant[]>([]);
  const [creditGrantsLoading, setCreditGrantsLoading] = useState(false);

  const fetchCreditGrants = useCallback(async () => {
    setCreditGrantsLoading(true);
    try {
      const res = await fetch("/api/admin/credit-grants?limit=50");
      if (res.ok) {
        const data = await res.json();
        setCreditGrants(data.grants || []);
      }
    } finally {
      setCreditGrantsLoading(false);
    }
  }, []);

  const [cases, setCases] = useState<{ id: string; summary: string; masterTypes: string; createdAt: string }[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [selectedCase, setSelectedCase] = useState<{ id: string; summary: string; fullContent: string; originalQuestion: string; masterTypes: string; createdAt: string } | null>(null);

  const [creditDefaults, setCreditDefaults] = useState({ defaultSingleRounds: 10, defaultMultiSessions: 1 });
  const [creditSaving, setCreditSaving] = useState(false);

  // --- AI Settings state ---
  const [aiSettings, setAiSettings] = useState<Record<string, MasterAIConfig>>({});
  const [aiLoading, setAiLoading] = useState(true);
  const [aiSaving, setAiSaving] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Omit<MasterAIConfig, "thinkingMode" | "thinkingBudget" | "effort" | "reasoningDepth"> & { thinkingMode: string; effort: string; thinkingBudget: number; reasoningDepth: string }>({
    provider: "byteplus",
    modelId: "",
    apiKey: "",
    apiUrl: "",
    thinkingMode: "disabled",
    effort: "medium",
    thinkingBudget: 5000,
    reasoningDepth: "high",
  });

  // --- Feedback state ---
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackUnread, setFeedbackUnread] = useState(0);
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySaving, setReplySaving] = useState(false);
  const [selectedFeedbackIds, setSelectedFeedbackIds] = useState<Set<number>>(new Set());
  const [feedbackDeleting, setFeedbackDeleting] = useState(false);

  // --- User management filter/sort/pagination state ---
  const [userSearch, setUserSearch] = useState("");
  const [userSortBy, setUserSortBy] = useState<"createdAt" | "name" | "email">("createdAt");
  const [userSortDir, setUserSortDir] = useState<"asc" | "desc">("desc");
  const [userPage, setUserPage] = useState(1);
  const USERS_PER_PAGE = 10;

  // --- TTS Settings state ---
  const [ttsConfig, setTtsConfig] = useState<{
    hasKey: boolean; modelId: string; stability: number; similarityBoost: number; style: number; speed: number;
  } | null>(null);
  const [ttsVoices, setTtsVoices] = useState<Record<string, Record<string, string>>>({});
  const [availableVoices, setAvailableVoices] = useState<{ voice_id: string; name: string; language: string; accent: string; description: string; gender: string; category: string }[]>([]);
  const [ttsApiKey, setTtsApiKey] = useState("");
  const [ttsEditConfig, setTtsEditConfig] = useState({
    modelId: "eleven_v3", stability: 0.7, similarityBoost: 0.75, style: 0.0, speed: 1.0,
  });
  const [ttsSaving, setTtsSaving] = useState(false);

  // --- TTS sub-tab ---
  const [ttsSubTab, setTtsSubTab] = useState<"voice" | "pronunciation">("voice");

  // --- TTS pronunciation rules state ---
  type TTSRule = {
    id: number;
    pattern: string;
    replacement: string;
    note: string | null;
    isActive: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
  };
  const [ttsRules, setTtsRules] = useState<TTSRule[]>([]);
  const [ttsRulesLoading, setTtsRulesLoading] = useState(false);
  const [newRulePattern, setNewRulePattern] = useState("");
  const [newRuleReplacement, setNewRuleReplacement] = useState("");
  const [newRuleNote, setNewRuleNote] = useState("");
  const [newRuleSaving, setNewRuleSaving] = useState(false);

  const fetchTTSRules = useCallback(async () => {
    setTtsRulesLoading(true);
    try {
      const res = await fetch("/api/admin/tts-replacements");
      if (res.ok) {
        const data = await res.json();
        setTtsRules(data.rules || []);
      }
    } finally {
      setTtsRulesLoading(false);
    }
  }, []);

  const createTTSRule = async () => {
    const pattern = newRulePattern.trim();
    const replacement = newRuleReplacement.trim();
    if (!pattern || !replacement) return;
    setNewRuleSaving(true);
    try {
      const res = await fetch("/api/admin/tts-replacements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pattern,
          replacement,
          note: newRuleNote.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || t("admin.saveFailed"));
        return;
      }
      setNewRulePattern("");
      setNewRuleReplacement("");
      setNewRuleNote("");
      await fetchTTSRules();
    } finally {
      setNewRuleSaving(false);
    }
  };

  const toggleTTSRule = async (rule: TTSRule) => {
    const res = await fetch(`/api/admin/tts-replacements/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    if (res.ok) await fetchTTSRules();
  };

  const deleteTTSRule = async (rule: TTSRule) => {
    if (!confirm(`確定要刪除「${rule.pattern} → ${rule.replacement}」嗎？`)) return;
    const res = await fetch(`/api/admin/tts-replacements/${rule.id}`, {
      method: "DELETE",
    });
    if (res.ok) await fetchTTSRules();
  };

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data.users || []);
      setStorageType(data.storageType || "");
      setStorageError(data.error || "");
    } catch {
      setStorageError(t("admin.apiError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchAISettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai-settings");
      const data = await res.json();
      setAiSettings(data.settings || {});
    } catch {
      // ignore
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchAISettings();
  }, [fetchUsers, fetchAISettings]);

  useEffect(() => {
    fetch("/api/admin/credit-settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.defaultSingleRounds !== undefined) {
          setCreditDefaults(data);
        }
      })
      .catch(() => {});
  }, []);

  const fetchUsage = useCallback(async (range: string) => {
    setUsageLoading(true);
    try {
      const res = await fetch(`/api/admin/usage?range=${range}`);
      if (res.ok) {
        const data = await res.json();
        setUsageData(data);
      }
    } catch (e) {
      console.error("[admin] Failed to fetch usage:", e);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "usage") {
      fetchUsage(usageRange);
    }
  }, [activeTab, usageRange, fetchUsage]);

  const fetchCases = useCallback(async () => {
    setCasesLoading(true);
    try {
      const res = await fetch("/api/admin/case-studies");
      if (res.ok) {
        const data = await res.json();
        setCases(data.cases || []);
      }
    } catch (e) {
      console.error("[admin] Failed to fetch cases:", e);
    } finally {
      setCasesLoading(false);
    }
  }, []);

  const fetchCaseDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/case-studies/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedCase(data);
      }
    } catch (e) {
      console.error("[admin] Failed to fetch case detail:", e);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "cases") {
      fetchCases();
    }
  }, [activeTab, fetchCases]);

  const fetchFeedback = useCallback(async () => {
    setFeedbackLoading(true);
    try {
      const res = await fetch("/api/admin/feedback");
      if (res.ok) {
        const data = await res.json();
        setFeedbackList(data.feedback || []);
        setFeedbackUnread(data.unreadCount || 0);
      }
    } catch (e) {
      console.error("[admin] Failed to fetch feedback:", e);
    } finally {
      setFeedbackLoading(false);
    }
  }, []);

  // Poll unread feedback count every 30s (background indicator)
  useEffect(() => {
    const loadCount = async () => {
      try {
        const res = await fetch("/api/admin/feedback", { method: "HEAD" });
        if (res.ok) {
          const count = parseInt(res.headers.get("x-unread-count") || "0", 10);
          setFeedbackUnread(count);
        }
      } catch {
        // ignore
      }
    };
    loadCount();
    const timer = setInterval(loadCount, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeTab === "feedback") {
      fetchFeedback();
    }
  }, [activeTab, fetchFeedback]);

  const submitReply = async (id: number) => {
    if (!replyText.trim()) return;
    setReplySaving(true);
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, reply: replyText.trim() }),
      });
      if (res.ok) {
        setReplyText("");
        await fetchFeedback();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || t("admin.saveFailed"));
      }
    } finally {
      setReplySaving(false);
    }
  };

  const markFeedbackRead = async (id: number) => {
    try {
      await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, markRead: true }),
      });
      setFeedbackList((prev) => prev.map((f) => (f.id === id ? { ...f, isRead: true } : f)));
      setFeedbackUnread((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  };

  const toggleFeedbackSelected = (id: number) => {
    setSelectedFeedbackIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFeedbackSelectAll = () => {
    setSelectedFeedbackIds((prev) => {
      if (prev.size === feedbackList.length) return new Set();
      return new Set(feedbackList.map((f) => f.id));
    });
  };

  const deleteFeedback = async (ids: number[]) => {
    if (ids.length === 0) return;
    const msg =
      ids.length === 1
        ? t("admin.feedbackConfirmDelete")
        : t("admin.feedbackConfirmDeleteBulk", { n: String(ids.length) });
    if (!confirm(msg)) return;
    setFeedbackDeleting(true);
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || t("admin.saveFailed"));
        return;
      }
      // Clear selection + refetch
      setSelectedFeedbackIds(new Set());
      if (selectedFeedbackId && ids.includes(selectedFeedbackId)) {
        setSelectedFeedbackId(null);
      }
      await fetchFeedback();
    } finally {
      setFeedbackDeleting(false);
    }
  };

  const fetchTTSSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tts-settings");
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setTtsConfig(data.settings);
          setTtsEditConfig({
            modelId: data.settings.modelId,
            stability: data.settings.stability,
            similarityBoost: data.settings.similarityBoost,
            style: data.settings.style,
            speed: data.settings.speed,
          });
        }
        if (data.voices) setTtsVoices(data.voices);
      }
      // Fetch available ElevenLabs voices
      const voicesRes = await fetch("/api/admin/tts-voices/list");
      if (voicesRes.ok) {
        const voicesData = await voicesRes.json();
        if (voicesData.voices) setAvailableVoices(voicesData.voices);
      }
    } catch (e) {
      console.error("[admin] Failed to fetch TTS settings:", e);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "tts") fetchTTSSettings();
  }, [activeTab, fetchTTSSettings]);

  useEffect(() => {
    if (activeTab === "tts" && ttsSubTab === "pronunciation") {
      fetchTTSRules();
    }
  }, [activeTab, ttsSubTab, fetchTTSRules]);

  useEffect(() => {
    if (activeTab === "usage") {
      fetchCreditGrants();
    }
  }, [activeTab, fetchCreditGrants]);

  const updateStatus = async (
    email: string,
    status: "approved" | "disabled"
  ) => {
    setActionLoading(email);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`${t("admin.operationFailed")}: ${data.error || res.statusText}`);
      }
      await fetchUsers();
    } finally {
      setActionLoading(null);
    }
  };

  const removeUser = async (email: string) => {
    if (!confirm(t("admin.deleteConfirm", { email }))) return;
    setActionLoading(email);
    try {
      await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      await fetchUsers();
    } finally {
      setActionLoading(null);
    }
  };

  // --- AI settings handlers ---
  const startEditing = (key: string) => {
    const existing = aiSettings[key];
    const defaultProvider = PROVIDERS["byteplus"];
    setEditForm({
      provider: existing?.provider || "byteplus",
      modelId: existing?.modelId || defaultProvider?.defaultModel || "",
      apiKey: "",
      apiUrl: existing?.apiUrl || defaultProvider?.defaultUrl || "",
      thinkingMode: existing?.thinkingMode || "disabled",
      effort: existing?.effort || "medium",
      thinkingBudget: existing?.thinkingBudget || 5000,
      reasoningDepth: existing?.reasoningDepth || "high",
    });
    setEditingKey(key);
  };

  const handleProviderChange = (provider: string) => {
    const info = PROVIDERS[provider];
    setEditForm((prev) => ({
      ...prev,
      provider,
      apiUrl: info?.defaultUrl || prev.apiUrl,
      modelId: info?.defaultModel || prev.modelId,
      // "adaptive" and "enabled" are Anthropic-specific concepts. When
      // switching away from Anthropic, force to "disabled" so stale values
      // don't leak into the summary badges of Google/OpenAI/BytePlus.
      thinkingMode: provider === "anthropic" ? prev.thinkingMode : "disabled",
    }));
  };

  const handleClaudeModelChange = (modelId: string) => {
    const model = CLAUDE_MODELS.find((m) => m.id === modelId);
    setEditForm((prev) => {
      let thinkingMode = prev.thinkingMode;
      // Auto-adjust thinking mode when switching model families
      if (model) {
        if (model.useEffort && thinkingMode === "enabled") {
          thinkingMode = "adaptive"; // upgrade to adaptive for 4.6
        } else if (!model.useEffort && thinkingMode === "adaptive") {
          thinkingMode = "enabled"; // downgrade to enabled for legacy
        }
      }
      return { ...prev, modelId, thinkingMode };
    });
  };

  const saveAISetting = async (key: string) => {
    setAiSaving(key);
    try {
      const res = await fetch("/api/admin/ai-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, ...editForm }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`${t("admin.saveFailed")}: ${data.error || res.statusText}`);
        return;
      }
      // Update local state immediately (don't rely on re-fetch which may read stale blob)
      const updated: MasterAIConfig = {
        provider: editForm.provider,
        modelId: editForm.modelId,
        apiKey: editForm.apiKey ? "••••" + editForm.apiKey.slice(-4) : (aiSettings[key]?.apiKey || ""),
        apiUrl: editForm.apiUrl,
        hasKey: !!(editForm.apiKey || aiSettings[key]?.hasKey),
        thinkingMode: editForm.thinkingMode as MasterAIConfig["thinkingMode"],
        effort: editForm.effort as MasterAIConfig["effort"],
        thinkingBudget: editForm.thinkingBudget,
        reasoningDepth: editForm.reasoningDepth as MasterAIConfig["reasoningDepth"],
      };
      setAiSettings((prev) => ({ ...prev, [key]: updated }));
      setEditingKey(null);
    } finally {
      setAiSaving(null);
    }
  };

  const resetAISetting = async (key: string) => {
    if (!confirm(t("admin.resetConfirm"))) return;
    setAiSaving(key);
    try {
      await fetch("/api/admin/ai-settings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      setEditingKey(null);
      await fetchAISettings();
    } finally {
      setAiSaving(null);
    }
  };

  const saveCreditSettings = async () => {
    setCreditSaving(true);
    try {
      const res = await fetch("/api/admin/credit-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creditDefaults),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`${t("admin.saveFailed")} ${data.error || ""}`);
      }
    } finally {
      setCreditSaving(false);
    }
  };

  const formatTokens = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  const pendingCount = users.filter((u) => u.status === "pending").length;

  const renderUserCard = (user: UserItem) => {
    const status = STATUS_LABELS[user.status];
    const isLoading = actionLoading === user.email;
    const isAdmin = user.email === "geektu@gmail.com";

    return (
      <div
        key={user.email}
        className={`rounded-lg border p-4 transition-colors ${
          user.status === "pending"
            ? "border-yellow-500/30 bg-yellow-500/[0.03]"
            : user.status === "unverified"
            ? "border-orange-400/30 bg-orange-400/[0.03]"
            : "border-gold/10"
        }`}
        style={{
          backgroundColor:
            user.status !== "pending" && user.status !== "unverified"
              ? "rgba(var(--glass-rgb), 0.02)"
              : undefined,
        }}
      >
        <div className="flex items-start gap-3 sm:items-center">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="w-10 h-10 rounded-full border border-gold/20 shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full border border-gold/20 bg-gold/10 flex items-center justify-center text-sm text-gold shrink-0">
              {user.name?.[0] || "?"}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-cream font-medium truncate">
                {user.name || t("admin.unnamed")}
              </span>
              <span className={`text-xs ${status.color}`}>{status.text}</span>
              {user.authProvider === "google" ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-sky-400/30 bg-sky-400/5 text-sky-300/80 flex items-center gap-1">
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21.35 11.1H12v3.2h5.35c-.5 2.4-2.55 3.6-5.35 3.6-3.25 0-5.9-2.65-5.9-5.9s2.65-5.9 5.9-5.9c1.45 0 2.75.5 3.75 1.45l2.4-2.4C16.55 3.75 14.45 3 12 3 7.05 3 3 7.05 3 12s4.05 9 9 9c5.2 0 8.6-3.65 8.6-8.8 0-.4-.05-.7-.1-1.1z" />
                  </svg>
                  Google 登入
                </span>
              ) : user.authProvider === "credentials" ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-400/30 bg-amber-400/5 text-amber-300/80 flex items-center gap-1">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email 註冊
                </span>
              ) : null}
              {user.username && (
                <span className="text-[10px] text-stone/50">@{user.username}</span>
              )}
            </div>
            <p className="text-xs text-stone/60 truncate">{user.email}</p>
            <p className="text-xs text-stone/40 mt-0.5">
              {t("admin.registeredOn")} {new Date(user.createdAt).toLocaleDateString("zh-TW")}
            </p>
            {((user.singleCredits ?? 0) > 0 || (user.multiCredits ?? 0) > 0) && (
              <p className="text-[10px] text-stone/40 mt-0.5">
                {t("admin.userCredits")}: S {user.singleUsed ?? 0}/{user.singleCredits ?? 0} | M {user.multiUsed ?? 0}/{user.multiCredits ?? 0}
              </p>
            )}
          </div>

          <div className="flex gap-2 shrink-0 flex-wrap justify-end">
            {isAdmin ? (
              <span className="text-xs text-stone/40">{t("admin.adminLabel")}</span>
            ) : isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
            ) : (
              <>
                {user.status === "pending" && (
                  <button
                    onClick={() => updateStatus(user.email, "approved")}
                    className="px-3 py-1.5 min-h-[36px] text-xs text-green-500 border border-green-500/30 rounded hover:bg-green-500/10 transition-colors"
                  >
                    {t("admin.approve")}
                  </button>
                )}
                {user.status === "approved" && (
                  <button
                    onClick={() => updateStatus(user.email, "disabled")}
                    className="px-3 py-1.5 min-h-[36px] text-xs text-yellow-500 border border-yellow-500/30 rounded hover:bg-yellow-500/10 transition-colors"
                  >
                    {t("admin.disable")}
                  </button>
                )}
                {user.status === "disabled" && (
                  <button
                    onClick={() => updateStatus(user.email, "approved")}
                    className="px-3 py-1.5 min-h-[36px] text-xs text-green-500 border border-green-500/30 rounded hover:bg-green-500/10 transition-colors"
                  >
                    {t("admin.enable")}
                  </button>
                )}
                <button
                  onClick={() => removeUser(user.email)}
                  className="px-3 py-1.5 min-h-[36px] text-xs text-red-400 border border-red-400/30 rounded hover:bg-red-400/10 transition-colors"
                >
                  {t("admin.delete")}
                </button>
                <button
                  onClick={async () => {
                    setActionLoading(user.email);
                    try {
                      await fetch("/api/admin/users", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: user.email, isAmbassador: !user.isAmbassador }),
                      });
                      fetchUsers();
                    } finally {
                      setActionLoading(null);
                    }
                  }}
                  className={`px-3 py-1.5 min-h-[36px] text-xs border rounded transition-colors ${
                    user.isAmbassador
                      ? "text-violet-400 border-violet-400/30 hover:bg-violet-400/10"
                      : "text-stone/50 border-stone/20 hover:bg-stone/10"
                  }`}
                >
                  {user.isAmbassador ? t("admin.removeAmbassador") : t("admin.setAmbassador")}
                </button>
                <button
                  onClick={async () => {
                    setActionLoading(user.email);
                    try {
                      await fetch("/api/admin/users", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: user.email, isFriend: !user.isFriend }),
                      });
                      fetchUsers();
                    } finally {
                      setActionLoading(null);
                    }
                  }}
                  className={`px-3 py-1.5 min-h-[36px] text-xs border rounded transition-colors ${
                    user.isFriend
                      ? "text-pink-400 border-pink-400/30 hover:bg-pink-400/10"
                      : "text-stone/50 border-stone/20 hover:bg-stone/10"
                  }`}
                >
                  {user.isFriend ? t("admin.removeFriend") : t("admin.setFriend")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Priority users (need attention) and the rest
  const { priorityUsers, normalUsers } = useMemo(() => {
    const search = userSearch.trim().toLowerCase();
    const matches = (u: UserItem) => {
      if (!search) return true;
      return (
        (u.name?.toLowerCase().includes(search) ?? false) ||
        (u.username?.toLowerCase().includes(search) ?? false) ||
        u.email.toLowerCase().includes(search)
      );
    };
    const filtered = users.filter(matches);
    const priority = filtered.filter((u) => u.status === "pending" || u.status === "unverified");
    const rest = filtered.filter((u) => u.status !== "pending" && u.status !== "unverified");

    const sorted = [...rest].sort((a, b) => {
      let cmp = 0;
      if (userSortBy === "name") {
        cmp = (a.name || "").localeCompare(b.name || "");
      } else if (userSortBy === "email") {
        cmp = a.email.localeCompare(b.email);
      } else {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return userSortDir === "asc" ? cmp : -cmp;
    });

    return { priorityUsers: priority, normalUsers: sorted };
  }, [users, userSearch, userSortBy, userSortDir]);

  const totalPages = Math.max(1, Math.ceil(normalUsers.length / USERS_PER_PAGE));
  const paginatedUsers = normalUsers.slice((userPage - 1) * USERS_PER_PAGE, userPage * USERS_PER_PAGE);

  // Reset to page 1 when search/sort changes
  useEffect(() => {
    setUserPage(1);
  }, [userSearch, userSortBy, userSortDir]);

  return (
    <main className="relative z-10 min-h-screen">
      <SmokeParticles />

      {/* Top bar */}
      <div className="relative z-20 flex items-center justify-between px-4 sm:px-6 pt-4 pb-2">
        <a
          href="/"
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
          {t("admin.backToHome")}
        </a>

        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <ThemeToggle />
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs text-stone hover:text-gold transition-colors"
          >
            {t("admin.logout")}
          </button>
        </div>
      </div>

      {/* Header */}
      <header className="text-center py-6">
        <h1 className="font-serif text-2xl font-bold tracking-[0.15em] text-gold">
          {t("admin.title")}
        </h1>
        <div className="mx-auto mt-4 w-24 gold-line" />
      </header>

      {/* Tabs */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 mb-6">
        <div className="flex gap-1 border-b border-gold/10">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === "users"
                ? "text-gold"
                : "text-stone/60 hover:text-stone"
            }`}
          >
            {t("admin.userTab")}
            {pendingCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-yellow-500/20 text-yellow-500 rounded-full">
                {pendingCount}
              </span>
            )}
            {activeTab === "users" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("ai")}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === "ai"
                ? "text-gold"
                : "text-stone/60 hover:text-stone"
            }`}
          >
            {t("admin.aiTab")}
            {activeTab === "ai" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("tts")}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === "tts" ? "text-gold" : "text-stone/60 hover:text-stone"
            }`}
          >
            {t("admin.ttsTab")}
            {activeTab === "tts" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("usage")}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === "usage"
                ? "text-gold"
                : "text-stone/60 hover:text-stone"
            }`}
          >
            {t("admin.usageTab")}
            {activeTab === "usage" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("cases")}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === "cases"
                ? "text-gold"
                : "text-stone/60 hover:text-stone"
            }`}
          >
            {t("admin.casesTab")}
            {activeTab === "cases" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("feedback")}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === "feedback"
                ? "text-gold"
                : "text-stone/60 hover:text-stone"
            }`}
          >
            {t("admin.feedbackTab")}
            {feedbackUnread > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] bg-red-500/20 text-red-400 rounded-full animate-pulse">
                {feedbackUnread}
              </span>
            )}
            {activeTab === "feedback" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === "payments"
                ? "text-gold"
                : "text-stone/60 hover:text-stone"
            }`}
          >
            付款管理
            {activeTab === "payments" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />
            )}
          </button>
        </div>
      </div>

      {/* Tab content */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-12">
        {activeTab === "users" && (
          <>
            {/* Storage status */}
            {storageType && (
              <p className="text-xs text-stone/50 mb-3 text-center">
                {t("admin.storage")}{storageType === "postgres" ? t("admin.storagePostgres") : t("admin.storageLocal")}
              </p>
            )}
            {storageError && (
              <div className="mb-4 mx-auto max-w-md px-4 py-2 rounded border border-red-400/30 bg-red-400/5">
                <p className="text-xs text-red-400">{storageError}</p>
                {storageType === "local" && (
                  <p className="text-xs text-stone/50 mt-1">
                    {t("admin.storageNote")}
                  </p>
                )}
              </div>
            )}

            {/* User list */}
            {loading ? (
              <div className="text-center py-12">
                <span className="inline-block w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-center text-stone/60 py-12">{t("admin.noUsers")}</p>
            ) : (
              <>
                {/* Search + Sort controls */}
                <div className="mb-4 grid grid-cols-1 sm:grid-cols-[1fr_10rem] gap-2">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone/40 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder={t("admin.userSearchPlaceholder")}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gold/20 rounded text-cream placeholder:text-stone/30 focus:border-gold/50 focus:outline-none"
                      style={{ backgroundColor: "rgba(var(--glass-rgb), 0.02)" }}
                    />
                  </div>
                  <select
                    value={`${userSortBy}-${userSortDir}`}
                    onChange={(e) => {
                      const [by, dir] = e.target.value.split("-") as [typeof userSortBy, typeof userSortDir];
                      setUserSortBy(by);
                      setUserSortDir(dir);
                    }}
                    className="w-full px-3 py-2 text-sm border border-gold/20 rounded text-cream focus:border-gold/50 focus:outline-none"
                    style={{ backgroundColor: "rgba(var(--glass-rgb), 0.02)" }}
                  >
                    <option value="createdAt-desc">{t("admin.sortCreatedDesc")}</option>
                    <option value="createdAt-asc">{t("admin.sortCreatedAsc")}</option>
                    <option value="name-asc">{t("admin.sortNameAsc")}</option>
                    <option value="name-desc">{t("admin.sortNameDesc")}</option>
                    <option value="email-asc">{t("admin.sortEmailAsc")}</option>
                    <option value="email-desc">{t("admin.sortEmailDesc")}</option>
                  </select>
                </div>

                {/* Priority users (needs attention) */}
                {priorityUsers.length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs text-yellow-500/80 mb-2 flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                      {t("admin.priorityUsersLabel")} ({priorityUsers.length})
                    </p>
                    <div className="space-y-3">
                      {priorityUsers.map((user) => renderUserCard(user))}
                    </div>
                  </div>
                )}

                {/* Regular users list (paginated) */}
                {normalUsers.length === 0 && priorityUsers.length === 0 ? (
                  <p className="text-center text-stone/60 py-8">{t("admin.noSearchResults")}</p>
                ) : normalUsers.length > 0 && (
                  <>
                    {priorityUsers.length > 0 && (
                      <p className="text-xs text-stone/50 mb-2 mt-4">
                        {t("admin.allUsersLabel")} ({normalUsers.length})
                      </p>
                    )}
                    <div className="space-y-3">
                      {paginatedUsers.map((user) => renderUserCard(user))}
                    </div>
                    {totalPages > 1 && (
                      <div className="mt-5 flex items-center justify-between gap-2">
                        <button
                          onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                          disabled={userPage === 1}
                          className="px-3 py-1.5 text-xs text-gold border border-gold/30 rounded hover:bg-gold/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          ← {t("admin.prevPage")}
                        </button>
                        <span className="text-xs text-stone/60">
                          {userPage} / {totalPages}
                        </span>
                        <button
                          onClick={() => setUserPage((p) => Math.min(totalPages, p + 1))}
                          disabled={userPage === totalPages}
                          className="px-3 py-1.5 text-xs text-gold border border-gold/30 rounded hover:bg-gold/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          {t("admin.nextPage")} →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        {activeTab === "ai" && (
          <>
            <p className="text-xs text-stone/50 mb-4 text-center">
              {t("admin.aiConfigDesc")}
            </p>

            {aiLoading ? (
              <div className="text-center py-12">
                <span className="inline-block w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {MASTER_KEYS.map(({ key, label }) => {
                  const config = aiSettings[key];
                  const isEditing = editingKey === key;
                  const isSaving = aiSaving === key;
                  const providerLabel = config
                    ? PROVIDERS[config.provider]?.label || config.provider
                    : t("admin.default");

                  return (
                    <div
                      key={key}
                      className="rounded-lg border border-gold/10 p-4"
                      style={{ backgroundColor: "rgba(var(--glass-rgb), 0.02)" }}
                    >
                      {/* Header row */}
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-sm text-cream font-medium">
                            {label}
                          </span>
                          <span className="ml-2 text-xs text-stone/50">
                            {config ? (
                              <>
                                {providerLabel} / {config.modelId}
                                {/* Adaptive/enabled thinking is Anthropic-only; don't show
                                    for Google/OpenAI/BytePlus where thinkingMode can be a
                                    stale leftover from a prior Anthropic config. */}
                                {config.provider === "anthropic" && config.thinkingMode && config.thinkingMode !== "disabled" && (
                                  <span className="ml-1.5 text-blue-400">
                                    {t("admin.thinking")}:{config.thinkingMode === "adaptive"
                                      ? `${t("admin.adaptive")}/${config.effort || "medium"}`
                                      : `${config.thinkingBudget || 5000}t`}
                                  </span>
                                )}
                                {/* 深度 is only meaningful for OpenAI (reasoning_effort param).
                                    Anthropic uses `effort` (shown above via adaptive/effort),
                                    Google also uses `effort`, BytePlus has its own thinkingMode.
                                    Showing it for non-OpenAI providers surfaces a stale default
                                    that doesn't correspond to what the backend actually sends. */}
                                {config.provider === "openai" && config.reasoningDepth && (
                                  <span className="ml-1.5 text-blue-400">
                                    {t("admin.depth")}:{config.reasoningDepth}
                                  </span>
                                )}
                                {config.provider === "google" && config.effort && (
                                  <span className="ml-1.5 text-blue-400">
                                    {t("admin.thinking")}:{config.effort}
                                  </span>
                                )}
                                {config.hasKey && (
                                  <span className="ml-1.5 text-green-500">Key {config.apiKey}</span>
                                )}
                              </>
                            ) : (
                              <span className="text-stone/40">{t("admin.useDefault")}</span>
                            )}
                          </span>
                        </div>
                        {!isEditing && (
                          <button
                            onClick={() => startEditing(key)}
                            className="px-3 py-1.5 min-h-[36px] text-xs text-gold border border-gold/30 rounded hover:bg-gold/10 transition-colors"
                          >
                            {t("admin.settings")}
                          </button>
                        )}
                      </div>

                      {/* Edit form */}
                      {isEditing && (
                        <div className="mt-3 space-y-3 border-t border-gold/10 pt-3">
                          {/* Provider - radio buttons */}
                          <div>
                            <label className="block text-xs text-stone/70 mb-2">
                              {t("admin.provider")}
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(PROVIDERS).map(([id, info]) => (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => handleProviderChange(id)}
                                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                                    editForm.provider === id
                                      ? "border-gold/50 text-gold bg-gold/10"
                                      : "border-gold/15 text-stone/70 hover:text-cream hover:border-gold/30"
                                  }`}
                                >
                                  {info.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Model — Claude gets a picker, others get text input */}
                          {editForm.provider === "anthropic" ? (
                            <div>
                              <label className="block text-xs text-stone/70 mb-2">
                                {t("admin.model")}
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {CLAUDE_MODELS.map((m) => (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => handleClaudeModelChange(m.id)}
                                    className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                                      editForm.modelId === m.id
                                        ? "border-gold/50 text-gold bg-gold/10"
                                        : "border-gold/15 text-stone/70 hover:text-cream hover:border-gold/30"
                                    }`}
                                  >
                                    {m.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label className="block text-xs text-stone/70 mb-1">
                                {t("admin.modelId")}
                              </label>
                              <input
                                type="text"
                                value={editForm.modelId}
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, modelId: e.target.value }))
                                }
                                placeholder={PROVIDERS[editForm.provider]?.defaultModel || t("admin.modelName")}
                                className="w-full px-3 py-2 text-sm border border-gold/20 rounded text-cream placeholder:text-stone/30 focus:border-gold/50 focus:outline-none"
                                style={{ backgroundColor: "var(--parchment)" }}
                              />
                            </div>
                          )}

                          {/* Thinking — Anthropic only */}
                          {editForm.provider === "anthropic" && (() => {
                            const selectedModel = CLAUDE_MODELS.find((m) => m.id === editForm.modelId);
                            const isEffortModel = selectedModel?.useEffort ?? false;
                            return (
                              <div>
                                <label className="block text-xs text-stone/70 mb-2">
                                  {t("admin.thinkingCapability")}
                                </label>
                                {isEffortModel ? (
                                  <>
                                    {/* 4.6 models: adaptive + effort */}
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setEditForm((f) => ({ ...f, thinkingMode: "disabled" }))}
                                        className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                                          editForm.thinkingMode === "disabled"
                                            ? "border-gold/50 text-gold bg-gold/10"
                                            : "border-gold/15 text-stone/70 hover:text-cream hover:border-gold/30"
                                        }`}
                                      >
                                        {t("admin.off")}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditForm((f) => ({ ...f, thinkingMode: "adaptive" }))}
                                        className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                                          editForm.thinkingMode === "adaptive"
                                            ? "border-gold/50 text-gold bg-gold/10"
                                            : "border-gold/15 text-stone/70 hover:text-cream hover:border-gold/30"
                                        }`}
                                      >
                                        {t("admin.adaptiveThinking")}
                                      </button>
                                    </div>
                                    {editForm.thinkingMode === "adaptive" && (
                                      <div className="mt-2">
                                        <label className="block text-xs text-stone/50 mb-2">
                                          {t("admin.effortLabel")}
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                          {EFFORT_OPTIONS.map((opt) => (
                                            <button
                                              key={opt.value}
                                              type="button"
                                              onClick={() => setEditForm((f) => ({ ...f, effort: opt.value }))}
                                              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                                                editForm.effort === opt.value
                                                  ? "border-blue-400/50 text-blue-400 bg-blue-400/10"
                                                  : "border-gold/15 text-stone/70 hover:text-cream hover:border-gold/30"
                                              }`}
                                            >
                                              {opt.label}
                                            </button>
                                          ))}
                                        </div>
                                        <p className="text-xs text-stone/40 mt-1">
                                          {t("admin.comprehensiveNote")}
                                        </p>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {/* Legacy models: enabled + budget_tokens */}
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setEditForm((f) => ({ ...f, thinkingMode: "disabled" }))}
                                        className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                                          editForm.thinkingMode === "disabled"
                                            ? "border-gold/50 text-gold bg-gold/10"
                                            : "border-gold/15 text-stone/70 hover:text-cream hover:border-gold/30"
                                        }`}
                                      >
                                        {t("admin.off")}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditForm((f) => ({ ...f, thinkingMode: "enabled" }))}
                                        className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                                          editForm.thinkingMode === "enabled"
                                            ? "border-gold/50 text-gold bg-gold/10"
                                            : "border-gold/15 text-stone/70 hover:text-cream hover:border-gold/30"
                                        }`}
                                      >
                                        {t("admin.enableThinking")}
                                      </button>
                                    </div>
                                    {editForm.thinkingMode === "enabled" && (
                                      <div className="mt-2">
                                        <label className="block text-xs text-stone/50 mb-1">
                                          {t("admin.thinkingBudget")}
                                        </label>
                                        <input
                                          type="number"
                                          min={1024}
                                          step={1000}
                                          value={editForm.thinkingBudget}
                                          onChange={(e) =>
                                            setEditForm((f) => ({ ...f, thinkingBudget: Math.max(1024, parseInt(e.target.value) || 1024) }))
                                          }
                                          className="w-40 px-3 py-2 text-sm border border-gold/20 rounded text-cream focus:border-gold/50 focus:outline-none"
                                          style={{ backgroundColor: "var(--parchment)" }}
                                        />
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            );
                          })()}

                          {/* BytePlus reasoning depth */}
                          {editForm.provider === "byteplus" && (
                            <div>
                              <label className="block text-xs text-stone/70 mb-2">
                                {t("admin.thinkingDepth")}
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {BYTEPLUS_DEPTH_OPTIONS.map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setEditForm((f) => ({ ...f, reasoningDepth: opt.value }))}
                                    className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                                      editForm.reasoningDepth === opt.value
                                        ? "border-gold/50 text-gold bg-gold/10"
                                        : "border-gold/15 text-stone/70 hover:text-cream hover:border-gold/30"
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Google Gemini thinking depth */}
                          {editForm.provider === "google" && (
                            <div>
                              <label className="block text-xs text-stone/70 mb-2">
                                {t("admin.thinkingDepth")}
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {EFFORT_OPTIONS.map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setEditForm((f) => ({ ...f, effort: opt.value }))}
                                    className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                                      editForm.effort === opt.value
                                        ? "border-gold/50 text-gold bg-gold/10"
                                        : "border-gold/15 text-stone/70 hover:text-cream hover:border-gold/30"
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                              <p className="text-[10px] text-stone/40 mt-2">{t("admin.comprehensiveNote")}</p>
                            </div>
                          )}

                          {/* API URL */}
                          <div>
                            <label className="block text-xs text-stone/70 mb-1">
                              {t("admin.apiEndpoint")}
                            </label>
                            <input
                              type="text"
                              value={editForm.apiUrl}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, apiUrl: e.target.value }))
                              }
                              placeholder={PROVIDERS[editForm.provider]?.defaultUrl || "https://..."}
                              className="w-full px-3 py-2 text-sm border border-gold/20 rounded text-cream placeholder:text-stone/30 focus:border-gold/50 focus:outline-none"
                              style={{ backgroundColor: "var(--parchment)" }}
                            />
                          </div>

                          {/* API Key */}
                          <div>
                            <label className="block text-xs text-stone/70 mb-1">
                              {t("admin.apiKeyLabel")}
                              {config?.hasKey && (
                                <span className="ml-1.5 text-stone/40">
                                  {t("admin.keepExistingKey")}
                                </span>
                              )}
                            </label>
                            <input
                              type="password"
                              value={editForm.apiKey}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, apiKey: e.target.value }))
                              }
                              placeholder={config?.hasKey ? t("admin.keepExistingKeyPlaceholder") : t("admin.enterApiKey")}
                              className="w-full px-3 py-2 text-sm border border-gold/20 rounded text-cream placeholder:text-stone/30 focus:border-gold/50 focus:outline-none"
                              style={{ backgroundColor: "var(--parchment)" }}
                            />
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 justify-end pt-1">
                            {config && (
                              <button
                                onClick={() => resetAISetting(key)}
                                disabled={isSaving}
                                className="px-3 py-1.5 min-h-[36px] text-xs text-red-400 border border-red-400/30 rounded hover:bg-red-400/10 transition-colors disabled:opacity-50"
                              >
                                {t("admin.resetToDefault")}
                              </button>
                            )}
                            <button
                              onClick={() => setEditingKey(null)}
                              disabled={isSaving}
                              className="px-3 py-1.5 min-h-[36px] text-xs text-stone border border-stone/30 rounded hover:bg-stone/10 transition-colors disabled:opacity-50"
                            >
                              {t("admin.cancel")}
                            </button>
                            <button
                              onClick={() => saveAISetting(key)}
                              disabled={isSaving}
                              className="px-3 py-1.5 min-h-[36px] text-xs text-gold border border-gold/30 rounded hover:bg-gold/10 transition-colors disabled:opacity-50"
                            >
                              {isSaving ? (
                                <span className="inline-block w-3 h-3 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                              ) : (
                                t("admin.save")
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Credit Settings */}
            <div className="mt-8 pt-6 border-t border-gold/10">
              <h3 className="text-sm font-serif text-gold mb-4">{t("admin.creditSettings")}</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs text-stone mb-1 block">{t("admin.defaultSingleRounds")}</label>
                  <input
                    type="number"
                    min={0}
                    value={creditDefaults.defaultSingleRounds}
                    onChange={(e) => setCreditDefaults((prev) => ({ ...prev, defaultSingleRounds: parseInt(e.target.value) || 0 }))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone mb-1 block">{t("admin.defaultMultiSessions")}</label>
                  <input
                    type="number"
                    min={0}
                    value={creditDefaults.defaultMultiSessions}
                    onChange={(e) => setCreditDefaults((prev) => ({ ...prev, defaultMultiSessions: parseInt(e.target.value) || 0 }))}
                    className="w-full"
                  />
                </div>
              </div>
              <button
                onClick={saveCreditSettings}
                disabled={creditSaving}
                className="px-4 py-2 text-xs border border-gold/30 rounded-sm text-gold hover:bg-gold/15 transition-colors disabled:opacity-40"
              >
                {creditSaving ? (
                  <span className="inline-block w-3 h-3 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                ) : (
                  t("admin.creditsSave")
                )}
              </button>
            </div>
          </>
        )}

        {activeTab === "tts" && (
          <>
            {/* TTS sub-tab navigation */}
            <div className="mb-6 flex gap-6 border-b border-gold/20">
              <button
                onClick={() => setTtsSubTab("voice")}
                className={`pb-3 text-sm font-serif transition-colors ${
                  ttsSubTab === "voice"
                    ? "border-b-2 border-gold text-gold"
                    : "text-stone/60 hover:text-stone"
                }`}
              >
                語音參數
              </button>
              <button
                onClick={() => setTtsSubTab("pronunciation")}
                className={`pb-3 text-sm font-serif transition-colors ${
                  ttsSubTab === "pronunciation"
                    ? "border-b-2 border-gold text-gold"
                    : "text-stone/60 hover:text-stone"
                }`}
              >
                發音校正
              </button>
            </div>

            {ttsSubTab === "voice" && (
            <>
            {/* Global TTS Settings */}
            <div className="rounded-lg border border-gold/10 p-6 mb-6" style={{ backgroundColor: "rgba(var(--glass-rgb), 0.02)" }}>
              <h3 className="text-sm font-serif text-gold mb-4">ElevenLabs {t("admin.ttsTab")}</h3>

              <div className="space-y-4">
                {/* API Key */}
                <div>
                  <label className="text-xs text-stone/70 mb-1 block">{t("admin.ttsApiKey")}</label>
                  <input
                    type="password"
                    value={ttsApiKey}
                    onChange={(e) => setTtsApiKey(e.target.value)}
                    placeholder={ttsConfig?.hasKey ? "••••••••（已設定）" : "sk-..."}
                    className="w-full"
                  />
                </div>

                {/* Model */}
                <div>
                  <label className="text-xs text-stone/70 mb-1 block">{t("admin.ttsModel")}</label>
                  <select
                    value={ttsEditConfig.modelId}
                    onChange={(e) => setTtsEditConfig((p) => ({ ...p, modelId: e.target.value }))}
                    className="w-full"
                  >
                    <option value="eleven_v3">v3 — 最富表達力 (70+ 語言 / 5K 字限制)</option>
                    <option value="eleven_flash_v2_5">Flash v2.5 — 即時低延遲 (~75ms, 32 語言 / 40K 字)</option>
                    <option value="eleven_multilingual_v2">Multilingual v2 — 情感豐富 (29 語言 / 10K 字)</option>
                  </select>
                  <p className="mt-1.5 text-[10px] text-stone/50 leading-relaxed">
                    此處僅影響**未來**的 TTS 呼叫；使用量統計中列出的歷史模型是過去曾使用過的紀錄，非目前設定。
                  </p>
                </div>

                {/* Voice Settings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-stone/70 mb-1 block">{t("admin.ttsStability")}: {ttsEditConfig.stability.toFixed(2)}</label>
                    <input type="range" min="0" max="1" step="0.05" value={ttsEditConfig.stability}
                      onChange={(e) => setTtsEditConfig((p) => ({ ...p, stability: parseFloat(e.target.value) }))}
                      className="w-full" />
                    <p className="mt-1 text-[10px] text-stone/50 leading-snug">
                      越高越穩、每次生成越一致（太低會亂念字、語速失控）。建議 <span className="text-gold/70">0.75 – 1.00</span>。
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-stone/70 mb-1 block">{t("admin.ttsSimilarity")}: {ttsEditConfig.similarityBoost.toFixed(2)}</label>
                    <input type="range" min="0" max="1" step="0.05" value={ttsEditConfig.similarityBoost}
                      onChange={(e) => setTtsEditConfig((p) => ({ ...p, similarityBoost: parseFloat(e.target.value) }))}
                      className="w-full" />
                    <p className="mt-1 text-[10px] text-stone/50 leading-snug">
                      越高越貼近聲源。聲源若有雜音，過高反而會一起放大。建議 <span className="text-gold/70">0.75</span>。
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-stone/70 mb-1 block">{t("admin.ttsSpeed")}: {ttsEditConfig.speed.toFixed(2)}</label>
                    <input type="range" min="0.7" max="1.2" step="0.05" value={ttsEditConfig.speed}
                      onChange={(e) => setTtsEditConfig((p) => ({ ...p, speed: parseFloat(e.target.value) }))}
                      className="w-full" />
                    <p className="mt-1 text-[10px] text-stone/50 leading-snug">
                      1.0 = 原速。&gt; 1.1 會吞音、字音糊掉；&lt; 0.8 會拖慢。ElevenLabs 上限 <span className="text-gold/70">0.7 – 1.2</span>。
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-stone/70 mb-1 block">{t("admin.ttsStyle")}: {ttsEditConfig.style.toFixed(2)}</label>
                    <input type="range" min="0" max="1" step="0.05" value={ttsEditConfig.style}
                      onChange={(e) => setTtsEditConfig((p) => ({ ...p, style: parseFloat(e.target.value) }))}
                      className="w-full" />
                    <p className="mt-1 text-[10px] text-amber-400/70 leading-snug">
                      ⚠ 官方建議保持 <span className="font-bold">0</span>。設得越高，模型越容易自由發揮、念錯字。若聽到字音不對，優先把這個歸零。
                    </p>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    setTtsSaving(true);
                    try {
                      await fetch("/api/admin/tts-settings", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ...ttsEditConfig, apiKey: ttsApiKey || undefined }),
                      });
                      await fetchTTSSettings();
                      setTtsApiKey("");
                    } finally {
                      setTtsSaving(false);
                    }
                  }}
                  disabled={ttsSaving}
                  className="px-4 py-2 text-xs border border-gold/30 rounded-sm text-gold hover:bg-gold/15 transition-colors disabled:opacity-40"
                >
                  {ttsSaving ? (
                    <span className="inline-block w-3 h-3 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                  ) : t("admin.ttsSave")}
                </button>
              </div>
            </div>

            {/* Per-Master Voice Mapping */}
            <div className="rounded-lg border border-gold/10 p-6" style={{ backgroundColor: "rgba(var(--glass-rgb), 0.02)" }}>
              <h3 className="text-sm font-serif text-gold mb-4">{t("admin.ttsVoices")}</h3>

              {availableVoices.length === 0 && ttsConfig?.hasKey && (
                <p className="text-xs text-stone/50 mb-4">Loading voices from ElevenLabs...</p>
              )}
              {!ttsConfig?.hasKey && (
                <p className="text-xs text-stone/50 mb-4">{t("admin.ttsNoKey")}</p>
              )}

              <div className="space-y-6">
                {["bazi", "ziwei", "zodiac"].map((master) => (
                  <div key={master}>
                    <p className="text-xs text-cream font-medium mb-2">{t(`master.${master}` as string)}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {["zh-Hant", "zh-Hans", "en", "ja"].map((loc) => (
                        <div key={loc} className="flex items-center gap-2">
                          <span className="text-[10px] text-stone/50 w-14 shrink-0">{loc}</span>
                          <select
                            value={ttsVoices[master]?.[loc] || ""}
                            onChange={async (e) => {
                              const val = e.target.value;
                              setTtsVoices((prev) => ({
                                ...prev,
                                [master]: { ...prev[master], [loc]: val },
                              }));
                              if (val) {
                                await fetch("/api/admin/tts-voices", {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ masterKey: master, locale: loc, voiceId: val }),
                                });
                              }
                            }}
                            className="flex-1 text-xs"
                          >
                            <option value="">-- {t("admin.ttsVoiceId")} --</option>
                            {availableVoices.map((v) => (
                              <option key={v.voice_id} value={v.voice_id}>
                                {v.name} {v.language ? `(${v.language})` : ""} {v.gender ? `· ${v.gender}` : ""} {v.description ? `— ${v.description}` : ""}
                              </option>
                            ))}
                            {/* Custom voice ID option */}
                            {ttsVoices[master]?.[loc] && !availableVoices.some((v) => v.voice_id === ttsVoices[master]?.[loc]) && (
                              <option value={ttsVoices[master][loc]}>
                                Custom: {ttsVoices[master][loc]}
                              </option>
                            )}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </>
            )}

            {ttsSubTab === "pronunciation" && (
              <div className="rounded-lg border border-gold/10 p-6" style={{ backgroundColor: "rgba(var(--glass-rgb), 0.02)" }}>
                <h3 className="text-sm font-serif text-gold mb-2">發音校正對照表</h3>
                <p className="text-[10px] text-stone/50 mb-5 leading-relaxed">
                  ElevenLabs TTS 有時會念錯特定中文字詞。在這裡新增「原文 → 替換文字」規則後，系統在語音合成前會自動將原文替換成替換文字（畫面上的文字不受影響）。
                </p>

                {/* New rule form */}
                <div className="flex flex-col sm:flex-row gap-2 mb-5 pb-5 border-b border-gold/10">
                  <input
                    type="text"
                    placeholder="原文（會念錯的字詞）"
                    value={newRulePattern}
                    onChange={(e) => setNewRulePattern(e.target.value)}
                    maxLength={200}
                    className="flex-1 text-sm"
                  />
                  <span className="hidden sm:flex items-center text-mist text-xs">→</span>
                  <input
                    type="text"
                    placeholder="替換為（正確讀音的同義詞）"
                    value={newRuleReplacement}
                    onChange={(e) => setNewRuleReplacement(e.target.value)}
                    maxLength={200}
                    className="flex-1 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="備註（選填）"
                    value={newRuleNote}
                    onChange={(e) => setNewRuleNote(e.target.value)}
                    className="flex-1 text-sm"
                  />
                  <button
                    type="button"
                    disabled={!newRulePattern.trim() || !newRuleReplacement.trim() || newRuleSaving}
                    onClick={createTTSRule}
                    className="px-4 py-2 rounded border border-gold/30 text-gold text-xs hover:bg-gold/10 disabled:opacity-30 transition-colors whitespace-nowrap"
                  >
                    {newRuleSaving ? "..." : "＋ 新增"}
                  </button>
                </div>

                {/* Rules table */}
                {ttsRulesLoading ? (
                  <p className="text-xs text-mist py-6 text-center">載入中...</p>
                ) : ttsRules.length === 0 ? (
                  <p className="text-xs text-stone/60 py-6 text-center">目前沒有發音校正規則</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gold/20 text-left text-mist text-xs">
                          <th className="py-2 pr-2">原文</th>
                          <th className="py-2 pr-2">替換為</th>
                          <th className="py-2 pr-2">備註</th>
                          <th className="py-2 pr-2 text-center">啟用</th>
                          <th className="py-2 pr-2 text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ttsRules.map((rule) => (
                          <tr
                            key={rule.id}
                            className={`border-b border-gold/10 ${!rule.isActive ? "opacity-40" : ""}`}
                          >
                            <td className="py-2 pr-2 font-mono text-cream">{rule.pattern}</td>
                            <td className="py-2 pr-2 font-mono text-gold">{rule.replacement}</td>
                            <td className="py-2 pr-2 text-xs text-stone/60 max-w-[200px] truncate">{rule.note ?? "—"}</td>
                            <td className="py-2 pr-2 text-center">
                              <button
                                type="button"
                                onClick={() => toggleTTSRule(rule)}
                                className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                                  rule.isActive
                                    ? "border-green-500/40 text-green-400 hover:bg-green-500/10"
                                    : "border-stone/30 text-stone/50 hover:bg-stone/10"
                                }`}
                              >
                                {rule.isActive ? "ON" : "OFF"}
                              </button>
                            </td>
                            <td className="py-2 pr-2 text-right">
                              <button
                                type="button"
                                onClick={() => deleteTTSRule(rule)}
                                className="text-xs text-stone/40 hover:text-red-400 transition-colors"
                              >
                                刪除
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === "usage" && (
          <>
            {/* Time range selector */}
            <div className="flex justify-center gap-1 mb-6">
              {(["1d", "1w", "1m", "3m", "6m", "1y"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setUsageRange(r)}
                  className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${
                    usageRange === r
                      ? "bg-gold/20 text-gold border border-gold/30"
                      : "text-stone/60 hover:text-stone border border-transparent"
                  }`}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>

            {usageLoading ? (
              <div className="text-center py-12">
                <span className="inline-block w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
              </div>
            ) : usageData ? (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="rounded-lg border border-gold/10 p-4 text-center" style={{ backgroundColor: "rgba(var(--glass-rgb), 0.02)" }}>
                    <p className="text-2xl font-bold text-gold">{usageData.summary.totalCalls}</p>
                    <p className="text-xs text-stone/60 mt-1">{t("admin.totalCalls")}</p>
                  </div>
                  <div className="rounded-lg border border-gold/10 p-4 text-center" style={{ backgroundColor: "rgba(var(--glass-rgb), 0.02)" }}>
                    <p className="text-2xl font-bold text-gold">{formatTokens(usageData.summary.totalInputTokens)}</p>
                    <p className="text-xs text-stone/60 mt-1">{t("admin.totalInputTokens")}</p>
                  </div>
                  <div className="rounded-lg border border-gold/10 p-4 text-center" style={{ backgroundColor: "rgba(var(--glass-rgb), 0.02)" }}>
                    <p className="text-2xl font-bold text-gold">{formatTokens(usageData.summary.totalOutputTokens)}</p>
                    <p className="text-xs text-stone/60 mt-1">{t("admin.totalOutputTokens")}</p>
                  </div>
                </div>

                {/* TTS (ElevenLabs) stats */}
                {usageData.tts && usageData.tts.calls > 0 && (
                  <div className="mb-6 rounded-lg border border-violet-400/15 p-4" style={{ backgroundColor: "rgba(var(--glass-rgb), 0.02)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                      <span className="text-sm font-serif text-violet-400">ElevenLabs TTS</span>
                    </div>
                    <div className="flex gap-6 text-xs text-stone/70">
                      <span>Calls: <span className="text-cream font-medium">{usageData.tts.calls}</span></span>
                      <span>Characters: <span className="text-cream font-medium">{formatTokens(usageData.tts.characters)}</span></span>
                      <span title="此區間內曾使用過的所有模型，並非當前設定">
                        此區間用過: <span className="text-cream">{usageData.tts.models.join(", ") || "-"}</span>
                      </span>
                    </div>
                  </div>
                )}

                {/* Credit grants audit log */}
                <div className="mb-6 rounded-lg border border-gold/15 p-4" style={{ backgroundColor: "rgba(var(--glass-rgb), 0.02)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-serif text-gold">額度紀錄（最近 50 筆）</span>
                    </div>
                    <span className="text-[10px] text-stone/50">
                      記錄由 /api/credits/send 透過「送額度」功能發出的每一次贈送
                    </span>
                  </div>

                  {creditGrantsLoading ? (
                    <p className="text-xs text-mist py-4 text-center">載入中...</p>
                  ) : creditGrants.length === 0 ? (
                    <p className="text-xs text-stone/60 py-4 text-center">尚無額度贈送紀錄</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gold/20 text-left text-mist">
                            <th className="py-2 pr-3 whitespace-nowrap">時間</th>
                            <th className="py-2 pr-3 whitespace-nowrap">贈送者</th>
                            <th className="py-2 pr-3 whitespace-nowrap">接收者</th>
                            <th className="py-2 pr-3 whitespace-nowrap">個別</th>
                            <th className="py-2 pr-3 whitespace-nowrap">三師</th>
                            <th className="py-2 pr-3 whitespace-nowrap">模式</th>
                          </tr>
                        </thead>
                        <tbody>
                          {creditGrants.map((g) => (
                            <tr key={g.id} className="border-b border-gold/10 text-cream">
                              <td className="py-2 pr-3 whitespace-nowrap text-stone/70">
                                {new Date(g.createdAt).toLocaleString("zh-HK", {
                                  year: "numeric", month: "2-digit", day: "2-digit",
                                  hour: "2-digit", minute: "2-digit",
                                })}
                              </td>
                              <td className="py-2 pr-3 truncate max-w-[180px]">{g.senderEmail}</td>
                              <td className="py-2 pr-3 truncate max-w-[180px]">{g.recipientEmail}</td>
                              <td className="py-2 pr-3 whitespace-nowrap">
                                {g.singleCredits > 0 ? (
                                  <span className="text-gold">+{g.singleCredits}</span>
                                ) : (
                                  <span className="text-stone/40">—</span>
                                )}
                              </td>
                              <td className="py-2 pr-3 whitespace-nowrap">
                                {g.multiCredits > 0 ? (
                                  <span className="text-gold">+{g.multiCredits}</span>
                                ) : (
                                  <span className="text-stone/40">—</span>
                                )}
                              </td>
                              <td className="py-2 pr-3 whitespace-nowrap">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] border ${
                                    g.deliveryMode === "direct"
                                      ? "border-green-500/30 text-green-400"
                                      : "border-amber-400/30 text-amber-300"
                                  }`}
                                  title={
                                    g.deliveryMode === "direct"
                                      ? "接收者當下已註冊，直接加到帳戶"
                                      : "接收者當下未註冊，存入 pending_credits，註冊時自動套用"
                                  }
                                >
                                  {g.deliveryMode === "direct" ? "直接贈送" : "待領取"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* User detail table */}
                {usageData.byUser.length === 0 ? (
                  <p className="text-center text-stone/60 py-12">{t("admin.noUsageData")}</p>
                ) : (
                  <div className="space-y-3">
                    {usageData.byUser.map((user) => (
                      <div
                        key={user.email}
                        className="rounded-lg border border-gold/10 p-4"
                        style={{ backgroundColor: "rgba(var(--glass-rgb), 0.02)" }}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          {user.image ? (
                            <img src={user.image} alt="" className="w-8 h-8 rounded-full border border-gold/20" />
                          ) : (
                            <div className="w-8 h-8 rounded-full border border-gold/20 bg-gold/10 flex items-center justify-center text-xs text-gold">
                              {user.name?.[0] || "?"}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-cream font-medium truncate">{user.name || user.email}</p>
                            <p className="text-xs text-stone/50 truncate">{user.email}</p>
                          </div>
                          <span className="text-lg font-bold text-gold">{user.calls}</span>
                          <span className="text-xs text-stone/50">{t("admin.usageCalls")}</span>
                        </div>
                        <div className="flex gap-4 text-xs text-stone/60">
                          <span>Input: <span className="text-cream">{formatTokens(user.inputTokens)}</span></span>
                          <span>Output: <span className="text-cream">{formatTokens(user.outputTokens)}</span></span>
                        </div>
                        {Object.keys(user.models).length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {Object.keys(user.models).map((model) => (
                              <span key={model} className="text-[10px] px-2 py-0.5 rounded-full border border-gold/15 text-stone/60">
                                {model}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </>
        )}

        {activeTab === "cases" && (
          <>
            {casesLoading ? (
              <div className="text-center py-12">
                <span className="inline-block w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
              </div>
            ) : selectedCase ? (
              /* Case detail view */
              <div>
                <button
                  onClick={() => setSelectedCase(null)}
                  className="text-sm text-stone hover:text-gold transition-colors mb-4 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                  </svg>
                  {t("admin.caseBack")}
                </button>
                <div className="rounded-lg border border-gold/10 p-6" style={{ backgroundColor: "rgba(var(--glass-rgb), 0.02)" }}>
                  <h3 className="text-sm font-serif text-gold mb-1">{t("admin.caseDetail")}</h3>
                  <p className="text-xs text-stone/50 mb-4">
                    {new Date(selectedCase.createdAt).toLocaleDateString()}
                  </p>
                  <div className="mb-4 p-3 rounded border border-gold/10 bg-gold/5">
                    <p className="text-sm text-cream font-medium">{selectedCase.summary}</p>
                  </div>
                  <pre className="text-sm text-cream/80 leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
                    {selectedCase.fullContent}
                  </pre>
                </div>
              </div>
            ) : cases.length === 0 ? (
              <p className="text-center text-stone/60 py-12">{t("admin.noCases")}</p>
            ) : (
              <div className="space-y-3">
                {cases.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => fetchCaseDetail(c.id)}
                    className="w-full text-left rounded-lg border border-gold/10 p-4 hover:border-gold/25 transition-colors"
                    style={{ backgroundColor: "rgba(var(--glass-rgb), 0.02)" }}
                  >
                    <p className="text-sm text-cream line-clamp-2">{c.summary}</p>
                    <p className="text-xs text-stone/50 mt-2">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "feedback" && (
          <>
            {feedbackLoading ? (
              <div className="text-center py-12">
                <span className="inline-block w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
              </div>
            ) : selectedFeedbackId !== null ? (() => {
              const fb = feedbackList.find((f) => f.id === selectedFeedbackId);
              if (!fb) return null;
              return (
                <div>
                  <button
                    onClick={() => { setSelectedFeedbackId(null); setReplyText(""); }}
                    className="text-sm text-stone hover:text-gold transition-colors mb-4 flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                    </svg>
                    {t("admin.feedbackBack")}
                  </button>
                  <div className="rounded-lg border border-gold/10 p-5" style={{ backgroundColor: "rgba(var(--glass-rgb), 0.02)" }}>
                    <div className="mb-4">
                      <p className="text-sm text-cream font-medium">{fb.name}</p>
                      <p className="text-xs text-stone/60">{fb.email}{fb.userEmail && fb.userEmail !== fb.email && ` · ${t("admin.feedbackLoggedAs")}: ${fb.userEmail}`}</p>
                      <p className="text-xs text-stone/40 mt-1">
                        {new Date(fb.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="mb-4 p-3 rounded border border-gold/10 bg-gold/5">
                      <p className="text-sm text-cream whitespace-pre-wrap leading-relaxed">{fb.message}</p>
                    </div>

                    {fb.reply ? (
                      <div className="mt-5 pt-4 border-t border-gold/10">
                        <p className="text-xs text-stone/50 mb-2">
                          {t("admin.feedbackRepliedAt")} {fb.repliedAt ? new Date(fb.repliedAt).toLocaleString() : ""}
                        </p>
                        <div className="p-3 rounded border border-green-500/20 bg-green-500/5">
                          <p className="text-sm text-cream/90 whitespace-pre-wrap leading-relaxed">{fb.reply}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 pt-4 border-t border-gold/10">
                        <label className="block text-xs text-stone/70 mb-2">
                          {t("admin.feedbackReplyLabel")}
                        </label>
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          rows={5}
                          placeholder={t("admin.feedbackReplyPlaceholder")}
                          className="w-full px-3 py-2 text-sm border border-gold/20 rounded text-cream placeholder:text-stone/30 focus:border-gold/50 focus:outline-none resize-none"
                          style={{ backgroundColor: "var(--parchment)" }}
                        />
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={() => submitReply(fb.id)}
                            disabled={replySaving || !replyText.trim()}
                            className="px-4 py-2 text-xs text-gold border border-gold/30 rounded hover:bg-gold/10 transition-colors disabled:opacity-40"
                          >
                            {replySaving ? (
                              <span className="inline-block w-3 h-3 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                            ) : (
                              t("admin.feedbackSendReply")
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })() : feedbackList.length === 0 ? (
              <p className="text-center text-stone/60 py-12">{t("admin.feedbackEmpty")}</p>
            ) : (
              <>
                {/* Bulk action toolbar */}
                <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-gold/15 bg-black/20 px-3 py-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-mist">
                    <input
                      type="checkbox"
                      checked={
                        feedbackList.length > 0 &&
                        selectedFeedbackIds.size === feedbackList.length
                      }
                      ref={(el) => {
                        if (el) {
                          el.indeterminate =
                            selectedFeedbackIds.size > 0 &&
                            selectedFeedbackIds.size < feedbackList.length;
                        }
                      }}
                      onChange={toggleFeedbackSelectAll}
                      className="accent-gold"
                    />
                    {t("admin.feedbackSelectAll")}
                  </label>
                  <span className="text-xs text-mist/60">
                    {t("admin.feedbackSelectedN", { n: String(selectedFeedbackIds.size) })}
                  </span>
                  <div className="ml-auto">
                    <button
                      type="button"
                      disabled={selectedFeedbackIds.size === 0 || feedbackDeleting}
                      onClick={() => deleteFeedback(Array.from(selectedFeedbackIds))}
                      className="text-xs px-3 py-1.5 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      {feedbackDeleting
                        ? t("admin.feedbackDeleting")
                        : t("admin.feedbackDeleteSelected")}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {feedbackList.map((fb) => {
                    const checked = selectedFeedbackIds.has(fb.id);
                    return (
                      <div
                        key={fb.id}
                        className={`rounded-lg border p-4 transition-colors ${
                          !fb.isRead
                            ? "border-red-400/30 bg-red-400/[0.03] hover:border-red-400/50"
                            : "border-gold/10 hover:border-gold/25"
                        }`}
                        style={{ backgroundColor: fb.isRead ? "rgba(var(--glass-rgb), 0.02)" : undefined }}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFeedbackSelected(fb.id)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={t("admin.feedbackSelectOne")}
                            className="mt-1 accent-gold shrink-0"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFeedbackId(fb.id);
                              setReplyText("");
                              if (!fb.isRead) markFeedbackRead(fb.id);
                            }}
                            className="flex-1 min-w-0 text-left"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm text-cream font-medium truncate">{fb.name}</p>
                                  {!fb.isRead && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                                      {t("admin.feedbackNew")}
                                    </span>
                                  )}
                                  {fb.reply && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-500">
                                      {t("admin.feedbackReplied")}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-stone/60 truncate">{fb.email}</p>
                                <p className="text-sm text-cream/80 line-clamp-2 mt-2">{fb.message}</p>
                              </div>
                              <p className="text-[10px] text-stone/40 shrink-0">
                                {new Date(fb.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteFeedback([fb.id]);
                            }}
                            aria-label={t("admin.feedbackConfirmDelete")}
                            className="shrink-0 text-stone/40 hover:text-red-400 transition-colors p-1"
                            disabled={feedbackDeleting}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {activeTab === "payments" && <PaymentsTab />}
      </section>

      <SiteFooter />
    </main>
  );
}
