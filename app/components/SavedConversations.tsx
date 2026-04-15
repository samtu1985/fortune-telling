"use client";

import { useState, useEffect, useMemo } from "react";
import ResultDisplay from "./ResultDisplay";
import { useLocale } from "./LocaleProvider";

interface SavedConv {
  id: string;
  type: string;
  userQuestion: string;
  aiResponse: string;
  aiReasoning?: string;
  profileLabel?: string;
  origin?: "manual" | "auto";
  savedAt: string;
}

interface SavedConversationsProps {
  type: "bazi" | "ziwei" | "zodiac" | "multi";
}

type Tab = "manual" | "auto";

export default function SavedConversations({ type }: SavedConversationsProps) {
  const { t } = useLocale();
  const [conversations, setConversations] = useState<SavedConv[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("manual");

  const fetchConversations = () => {
    setLoading(true);
    fetch(`/api/saved-conversations?type=${type}`)
      .then((res) => res.json())
      .then((data) => setConversations(data.conversations || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchConversations();
    const handler = () => fetchConversations();
    window.addEventListener("conversation-saved", handler);
    return () => window.removeEventListener("conversation-saved", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const handleDelete = async (id: string) => {
    await fetch(`/api/saved-conversations/${id}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((c) => c.id !== id));
  };

  const typeLabel = useMemo(
    () =>
      ({
        bazi: t("saved.bazi"),
        ziwei: t("saved.ziwei"),
        zodiac: t("saved.zodiac"),
        multi: t("saved.multi"),
      })[type],
    [type, t]
  );

  const manualConvs = conversations.filter((c) => (c.origin ?? "manual") === "manual");
  const autoConvs = conversations.filter((c) => c.origin === "auto");
  const visible = tab === "manual" ? manualConvs : autoConvs;

  return (
    <div>
      {/* Sub-tabs */}
      <div className="mb-5 flex gap-4 border-b border-gold/15">
        <button
          type="button"
          onClick={() => setTab("manual")}
          className={`pb-2 text-sm font-serif transition-colors ${
            tab === "manual"
              ? "border-b-2 border-gold text-gold"
              : "text-stone/60 hover:text-stone"
          }`}
        >
          {t("saved.tabManual")}
          <span className="ml-1.5 text-[10px] text-stone/40">({manualConvs.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setTab("auto")}
          className={`pb-2 text-sm font-serif transition-colors ${
            tab === "auto"
              ? "border-b-2 border-gold text-gold"
              : "text-stone/60 hover:text-stone"
          }`}
        >
          {t("saved.tabAuto")}
          <span className="ml-1.5 text-[10px] text-stone/40">({autoConvs.length}/3)</span>
        </button>
      </div>

      {tab === "auto" && (
        <p className="mb-4 text-[11px] text-stone/50 leading-relaxed">
          {t("saved.autoHint")}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="inline-block w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-stone/50">
            {tab === "manual"
              ? t("saved.noConversations", { type: typeLabel })
              : t("saved.noAutoConversations", { type: typeLabel })}
          </p>
          {tab === "manual" && (
            <p className="text-xs text-stone/30 mt-2">{t("saved.howToSave")}</p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {visible.map((conv) => (
            <div
              key={conv.id}
              className="border border-gold/10 rounded-lg p-4"
              style={{ background: "rgba(var(--glass-rgb), 0.02)" }}
            >
              {/* Metadata */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs text-stone/50 flex-wrap">
                  {conv.origin === "auto" && (
                    <span className="px-2 py-0.5 rounded-full border border-amber-400/30 bg-amber-400/5 text-amber-300/80 text-[10px]">
                      {t("saved.autoBadge")}
                    </span>
                  )}
                  {conv.profileLabel && (
                    <span className="px-2 py-0.5 rounded-full border border-gold/15 text-gold-dim">
                      {conv.profileLabel}
                    </span>
                  )}
                  <span>
                    {new Date(conv.savedAt).toLocaleString("zh-TW", {
                      year: "numeric", month: "2-digit", day: "2-digit",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(conv.id)}
                  className="text-xs text-stone/40 hover:text-red-seal transition-colors min-h-[32px] px-2"
                >
                  {t("saved.delete")}
                </button>
              </div>

              {/* User question as blockquote */}
              <div className="mb-3 pl-3 border-l-2 border-gold/20">
                <p className="text-sm text-stone/70 leading-relaxed whitespace-pre-wrap">
                  {conv.userQuestion}
                </p>
              </div>

              {/* AI response */}
              <ResultDisplay
                content={conv.aiResponse}
                reasoning={conv.aiReasoning || ""}
                streaming={false}
                hideDisclaimer
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
