"use client";

import { useState, useEffect, useMemo } from "react";
import ResultDisplay from "./ResultDisplay";

interface SavedConv {
  id: string;
  type: string;
  userQuestion: string;
  aiResponse: string;
  aiReasoning?: string;
  profileLabel?: string;
  savedAt: string;
}

interface SavedConversationsProps {
  type: "bazi" | "ziwei" | "zodiac";
}

export default function SavedConversations({ type }: SavedConversationsProps) {
  const [conversations, setConversations] = useState<SavedConv[]>([]);
  const [loading, setLoading] = useState(true);

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
    () => ({ bazi: "八字", ziwei: "紫微", zodiac: "星座" })[type],
    [type]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="inline-block w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-stone/50">
          尚未保存任何{typeLabel}的對話
        </p>
        <p className="text-xs text-stone/30 mt-2">
          在對話中點擊 AI 回覆下方的「保存」按鈕即可收藏
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          className="border border-gold/10 rounded-lg p-4"
          style={{ background: "rgba(var(--glass-rgb), 0.02)" }}
        >
          {/* Metadata */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs text-stone/50">
              {conv.profileLabel && (
                <span className="px-2 py-0.5 rounded-full border border-gold/15 text-gold-dim">
                  {conv.profileLabel}
                </span>
              )}
              <span>{new Date(conv.savedAt).toLocaleDateString("zh-TW")}</span>
            </div>
            <button
              onClick={() => handleDelete(conv.id)}
              className="text-xs text-stone/40 hover:text-red-seal transition-colors min-h-[32px] px-2"
            >
              刪除
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
  );
}
