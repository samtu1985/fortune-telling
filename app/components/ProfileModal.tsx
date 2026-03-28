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

  useEffect(() => {
    if (open) {
      try {
        const saved = localStorage.getItem("user_profile");
        if (saved) {
          const profile = JSON.parse(saved);
          setBirthDate(profile.birthDate || "");
          setBirthTime(profile.birthTime || "");
          setGender(profile.gender || "");
          setBirthPlace(profile.birthPlace || "");
        }
      } catch {
        // ignore
      }
    }
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

  const handleSave = () => {
    const profile = { birthDate, birthTime, gender, birthPlace };
    localStorage.setItem("user_profile", JSON.stringify(profile));
    window.dispatchEvent(new Event("profile-updated"));
    onClose();
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

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 min-h-[44px] rounded-sm text-sm text-stone border border-gold/10 hover:bg-gold/5 transition-colors font-serif tracking-widest"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 min-h-[44px] rounded-sm text-sm text-gold border border-gold/20 bg-gold/10 hover:bg-gold/20 transition-colors font-serif tracking-widest"
          >
            儲存
          </button>
        </div>
      </div>
    </div>
  );
}
