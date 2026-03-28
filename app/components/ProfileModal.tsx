"use client";

import { useState, useEffect } from "react";

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ProfileModal({ open, onClose }: ProfileModalProps) {
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [gender, setGender] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) {
          setBirthDate(data.profile.birthDate || "");
          setBirthTime(data.profile.birthTime || "");
          setGender(data.profile.gender || "");
          setBirthPlace(data.profile.birthPlace || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const profile = { birthDate, birthTime, gender, birthPlace };
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      window.dispatchEvent(new Event("profile-updated"));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-md p-6 rounded-lg border border-gold/20 animate-fade-in-up"
        style={{ background: "var(--parchment)", animationDuration: "0.3s" }}
      >
        <h2 className="font-serif text-lg text-gold tracking-wide mb-1">
          管理個人基本資訊
        </h2>
        <p className="text-xs text-stone/60 mb-6">
          儲存後將自動帶入命理推算表單
        </p>

        {loading ? (
          <div className="flex justify-center py-8">
            <span className="inline-block w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label>出生日期</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label>出生時間（精確到分鐘）</label>
              <input
                type="time"
                value={birthTime}
                onChange={(e) => setBirthTime(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label>性別</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="">不提供</option>
                <option value="男">男</option>
                <option value="女">女</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label>出生地點（城市）</label>
              <input
                type="text"
                placeholder="例：台北、高雄、東京、紐約"
                value={birthPlace}
                onChange={(e) => setBirthPlace(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 min-h-[44px] rounded-sm text-sm text-stone border border-gold/10 hover:bg-gold/5 transition-colors font-serif tracking-widest"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 py-2.5 min-h-[44px] rounded-sm text-sm text-gold border border-gold/20 bg-gold/10 hover:bg-gold/20 transition-colors font-serif tracking-widest disabled:opacity-50"
          >
            {saving ? "儲存中..." : "儲存"}
          </button>
        </div>
      </div>
    </div>
  );
}
