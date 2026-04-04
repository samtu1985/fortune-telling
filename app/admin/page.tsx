"use client";

import { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";
import SmokeParticles from "@/app/components/SmokeParticles";
import ThemeToggle from "@/app/components/ThemeToggle";

interface UserItem {
  email: string;
  name: string | null;
  image: string | null;
  status: "pending" | "approved" | "disabled";
  createdAt: string;
  approvedAt: string | null;
}

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  pending: { text: "待審核", color: "text-yellow-500" },
  approved: { text: "已核准", color: "text-green-500" },
  disabled: { text: "已停用", color: "text-red-400" },
};

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

const PROVIDERS: Record<string, ProviderInfo> = {
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
    defaultModel: "gemini-2.5-flash",
  },
  custom: {
    label: "自訂 (OpenAI 相容)",
    defaultUrl: "",
    defaultModel: "",
  },
};

const MASTER_KEYS = [
  { key: "bazi", label: "八字老師" },
  { key: "ziwei", label: "紫微老師" },
  { key: "zodiac", label: "星座老師" },
];

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

const EFFORT_OPTIONS = [
  { value: "low", label: "低 — 快速" },
  { value: "medium", label: "中 — 平衡" },
  { value: "high", label: "高 — 深度" },
];

const BYTEPLUS_DEPTH_OPTIONS = [
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
  { value: "off", label: "關" },
];

type Tab = "users" | "ai";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("tab") === "ai" ? "ai" : "users";
    }
    return "users";
  });

  // --- Users state ---
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [storageType, setStorageType] = useState<string>("");
  const [storageError, setStorageError] = useState<string>("");

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

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data.users || []);
      setStorageType(data.storageType || "");
      setStorageError(data.error || "");
    } catch {
      setStorageError("無法連接 API");
    } finally {
      setLoading(false);
    }
  }, []);

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
        alert(`操作失敗: ${data.error || res.statusText}`);
      }
      await fetchUsers();
    } finally {
      setActionLoading(null);
    }
  };

  const removeUser = async (email: string) => {
    if (!confirm(`確定要刪除 ${email} 嗎？`)) return;
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
      thinkingMode: provider === "anthropic" ? "disabled" : prev.thinkingMode,
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
        alert(`儲存失敗: ${data.error || res.statusText}`);
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
      // Also re-fetch in background to sync
      fetchAISettings();
    } finally {
      setAiSaving(null);
    }
  };

  const resetAISetting = async (key: string) => {
    if (!confirm("確定要重置為預設值嗎？將使用環境變數中的 BytePlus 設定。")) return;
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

  const pendingCount = users.filter((u) => u.status === "pending").length;

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
          返回首頁
        </a>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs text-stone hover:text-gold transition-colors"
          >
            登出
          </button>
        </div>
      </div>

      {/* Header */}
      <header className="text-center py-6">
        <h1 className="font-serif text-2xl font-bold tracking-[0.15em] text-gold">
          後台管理
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
            使用者管理
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
            AI 引擎設定
            {activeTab === "ai" && (
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
                儲存：{storageType === "blob" ? "Vercel Blob" : "本機檔案"}
              </p>
            )}
            {storageError && (
              <div className="mb-4 mx-auto max-w-md px-4 py-2 rounded border border-red-400/30 bg-red-400/5">
                <p className="text-xs text-red-400">{storageError}</p>
                {storageType === "local" && (
                  <p className="text-xs text-stone/50 mt-1">
                    在 Vercel 上需設定 Blob Storage 才能正常儲存使用者資料
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
              <p className="text-center text-stone/60 py-12">尚無使用者</p>
            ) : (
              <div className="space-y-3">
                {users.map((user) => {
                  const status = STATUS_LABELS[user.status];
                  const isLoading = actionLoading === user.email;
                  const isAdmin = user.email === "geektu@gmail.com";

                  return (
                    <div
                      key={user.email}
                      className={`
                        rounded-lg border p-4 transition-colors
                        ${
                          user.status === "pending"
                            ? "border-yellow-500/30 bg-yellow-500/[0.03]"
                            : "border-gold/10"
                        }
                      `}
                      style={{
                        backgroundColor:
                          user.status !== "pending"
                            ? "rgba(var(--glass-rgb), 0.02)"
                            : undefined,
                      }}
                    >
                      <div className="flex items-start gap-3 sm:items-center">
                        {/* Avatar */}
                        {user.image ? (
                          <img
                            src={user.image}
                            alt=""
                            className="w-10 h-10 rounded-full border border-gold/20 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full border border-gold/20 bg-gold/10 flex items-center justify-center text-sm text-gold shrink-0">
                            {user.name?.[0] || "?"}
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-cream font-medium truncate">
                              {user.name || "未命名"}
                            </span>
                            <span className={`text-xs ${status.color}`}>
                              {status.text}
                            </span>
                          </div>
                          <p className="text-xs text-stone/60 truncate">
                            {user.email}
                          </p>
                          <p className="text-xs text-stone/40 mt-0.5">
                            註冊於{" "}
                            {new Date(user.createdAt).toLocaleDateString("zh-TW")}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 shrink-0">
                          {isAdmin ? (
                            <span className="text-xs text-stone/40">管理員</span>
                          ) : isLoading ? (
                            <span className="inline-block w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                          ) : (
                            <>
                              {user.status === "pending" && (
                                <button
                                  onClick={() =>
                                    updateStatus(user.email, "approved")
                                  }
                                  className="px-3 py-1.5 min-h-[36px] text-xs text-green-500 border border-green-500/30 rounded hover:bg-green-500/10 transition-colors"
                                >
                                  核准
                                </button>
                              )}
                              {user.status === "approved" && (
                                <button
                                  onClick={() =>
                                    updateStatus(user.email, "disabled")
                                  }
                                  className="px-3 py-1.5 min-h-[36px] text-xs text-yellow-500 border border-yellow-500/30 rounded hover:bg-yellow-500/10 transition-colors"
                                >
                                  停用
                                </button>
                              )}
                              {user.status === "disabled" && (
                                <button
                                  onClick={() =>
                                    updateStatus(user.email, "approved")
                                  }
                                  className="px-3 py-1.5 min-h-[36px] text-xs text-green-500 border border-green-500/30 rounded hover:bg-green-500/10 transition-colors"
                                >
                                  啟用
                                </button>
                              )}
                              <button
                                onClick={() => removeUser(user.email)}
                                className="px-3 py-1.5 min-h-[36px] text-xs text-red-400 border border-red-400/30 rounded hover:bg-red-400/10 transition-colors"
                              >
                                刪除
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === "ai" && (
          <>
            <p className="text-xs text-stone/50 mb-4 text-center">
              為每位命理老師設定使用的 AI 模型。未設定的老師將使用環境變數中的預設值 (BytePlus)。
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
                    : "預設 (環境變數)";

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
                                {config.thinkingMode && config.thinkingMode !== "disabled" && (
                                  <span className="ml-1.5 text-blue-400">
                                    思考:{config.thinkingMode === "adaptive"
                                      ? `自適應/${config.effort || "medium"}`
                                      : `${config.thinkingBudget || 5000}t`}
                                  </span>
                                )}
                                {config.reasoningDepth && (
                                  <span className="ml-1.5 text-blue-400">
                                    深度:{config.reasoningDepth}
                                  </span>
                                )}
                                {config.hasKey && (
                                  <span className="ml-1.5 text-green-500">Key {config.apiKey}</span>
                                )}
                              </>
                            ) : (
                              <span className="text-stone/40">使用預設</span>
                            )}
                          </span>
                        </div>
                        {!isEditing && (
                          <button
                            onClick={() => startEditing(key)}
                            className="px-3 py-1.5 min-h-[36px] text-xs text-gold border border-gold/30 rounded hover:bg-gold/10 transition-colors"
                          >
                            設定
                          </button>
                        )}
                      </div>

                      {/* Edit form */}
                      {isEditing && (
                        <div className="mt-3 space-y-3 border-t border-gold/10 pt-3">
                          {/* Provider - radio buttons */}
                          <div>
                            <label className="block text-xs text-stone/70 mb-2">
                              AI 供應商
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
                                模型
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
                                模型 ID
                              </label>
                              <input
                                type="text"
                                value={editForm.modelId}
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, modelId: e.target.value }))
                                }
                                placeholder={PROVIDERS[editForm.provider]?.defaultModel || "模型名稱"}
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
                                  思考能力
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
                                        關閉
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
                                        自適應思考
                                      </button>
                                    </div>
                                    {editForm.thinkingMode === "adaptive" && (
                                      <div className="mt-2">
                                        <label className="block text-xs text-stone/50 mb-2">
                                          思考深度 (effort)
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
                                          三師問道會自動使用「低」以加速回應
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
                                        關閉
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
                                        啟用思考
                                      </button>
                                    </div>
                                    {editForm.thinkingMode === "enabled" && (
                                      <div className="mt-2">
                                        <label className="block text-xs text-stone/50 mb-1">
                                          思考預算 (tokens，最小 1024)
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
                                思考深度
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

                          {/* API URL */}
                          <div>
                            <label className="block text-xs text-stone/70 mb-1">
                              API 端點
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
                              API Key
                              {config?.hasKey && (
                                <span className="ml-1.5 text-stone/40">
                                  (留空則保留原有 Key)
                                </span>
                              )}
                            </label>
                            <input
                              type="password"
                              value={editForm.apiKey}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, apiKey: e.target.value }))
                              }
                              placeholder={config?.hasKey ? "保留原有 Key" : "輸入 API Key"}
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
                                重置為預設
                              </button>
                            )}
                            <button
                              onClick={() => setEditingKey(null)}
                              disabled={isSaving}
                              className="px-3 py-1.5 min-h-[36px] text-xs text-stone border border-stone/30 rounded hover:bg-stone/10 transition-colors disabled:opacity-50"
                            >
                              取消
                            </button>
                            <button
                              onClick={() => saveAISetting(key)}
                              disabled={isSaving}
                              className="px-3 py-1.5 min-h-[36px] text-xs text-gold border border-gold/30 rounded hover:bg-gold/10 transition-colors disabled:opacity-50"
                            >
                              {isSaving ? (
                                <span className="inline-block w-3 h-3 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                              ) : (
                                "儲存"
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
          </>
        )}
      </section>
    </main>
  );
}
