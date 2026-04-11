"use client";

import { useState, useEffect } from "react";
import ConfirmDialog from "./ConfirmDialog";

interface Profile {
  id: string;
  label: string;
  birthDate: string;
  birthTime: string;
  gender: string;
  birthPlace: string;
  calendarType: string;
  isLeapMonth: boolean;
}

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ProfileModal({ open, onClose }: ProfileModalProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [label, setLabel] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [gender, setGender] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [calendarType, setCalendarType] = useState("solar");
  const [isLeapMonth, setIsLeapMonth] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setLabel("");
    setBirthDate("");
    setBirthTime("");
    setGender("");
    setBirthPlace("");
    setCalendarType("solar");
    setIsLeapMonth(false);
    setEditingId(null);
    setIsAdding(false);
  };

  const loadProfiles = () => {
    setLoading(true);
    fetch("/api/profiles")
      .then((res) => res.json())
      .then((data) => setProfiles(data.profiles || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) {
      loadProfiles();
      resetForm();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const startEdit = (p: Profile) => {
    setEditingId(p.id);
    setIsAdding(false);
    setLabel(p.label);
    setBirthDate(p.birthDate);
    setBirthTime(p.birthTime);
    setGender(p.gender);
    setBirthPlace(p.birthPlace);
    setCalendarType(p.calendarType || "solar");
    setIsLeapMonth(p.isLeapMonth || false);
  };

  const startAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleSave = async () => {
    if (!label.trim()) return;
    setSaving(true);
    try {
      const body = { label: label.trim(), birthDate, birthTime, gender, birthPlace, calendarType, isLeapMonth };
      let updated = profiles;
      if (editingId) {
        const res = await fetch(`/api/profiles/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          updated = profiles.map((p) => (p.id === editingId ? { ...p, ...body } : p));
          setProfiles(updated);
        }
      } else {
        const res = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            updated = [...profiles, data.profile];
            setProfiles(updated);
          }
        }
      }
      window.dispatchEvent(new CustomEvent("profiles-updated", { detail: updated }));
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/profiles/${id}`, { method: "DELETE" });
    const updated = res.ok ? profiles.filter((p) => p.id !== id) : profiles;
    if (res.ok) {
      setProfiles(updated);
    }
    window.dispatchEvent(new CustomEvent("profiles-updated", { detail: updated }));
    setDeleteConfirm(null);
    if (editingId === id) resetForm();
  };

  if (!open) return null;

  const showForm = isAdding || editingId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative w-full max-w-md max-h-[85dvh] flex flex-col rounded-lg border border-gold/20 animate-fade-in-up"
        style={{ background: "var(--parchment)", animationDuration: "0.3s" }}
      >
        <div className="p-6 pb-3 shrink-0">
          <h2 className="font-serif text-lg text-gold tracking-wide mb-1">
            管理出生資料檔案
          </h2>
          <p className="text-xs text-stone/60">
            已保存 {profiles.length}/10 筆
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <span className="inline-block w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
            </div>
          ) : showForm ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label>名稱 *</label>
                <input
                  type="text"
                  placeholder="例：本人、母親、另一半"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label>出生日期</label>
                <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label>出生時間</label>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="時"
                    value={birthTime.split(":")[0] ?? ""}
                    onChange={(e) => {
                      const h = e.target.value;
                      const m = birthTime.split(":")[1] ?? "00";
                      setBirthTime(h ? `${h}:${m}` : "");
                    }}
                    className="flex-1"
                  >
                    <option value="">--</option>
                    {Array.from({ length: 24 }, (_, i) => {
                      const v = String(i).padStart(2, "0");
                      return (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      );
                    })}
                  </select>
                  <span className="text-mist">:</span>
                  <select
                    aria-label="分"
                    value={birthTime.split(":")[1] ?? ""}
                    onChange={(e) => {
                      const h = birthTime.split(":")[0] ?? "00";
                      const m = e.target.value;
                      setBirthTime(m ? `${h}:${m}` : "");
                    }}
                    className="flex-1"
                  >
                    <option value="">--</option>
                    {Array.from({ length: 60 }, (_, i) => {
                      const v = String(i).padStart(2, "0");
                      return (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      );
                    })}
                  </select>
                  <span className="text-xs text-mist/70 whitespace-nowrap">24h</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label>性別</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">不提供</option>
                  <option value="男">男</option>
                  <option value="女">女</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label>出生地點</label>
                <input type="text" placeholder="例：台北" value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label>曆法</label>
                <select value={calendarType} onChange={(e) => { setCalendarType(e.target.value); setIsLeapMonth(false); }}>
                  <option value="solar">國曆（陽曆）</option>
                  <option value="lunar">農曆（陰曆）</option>
                </select>
                {calendarType === "lunar" && (
                  <label className="flex items-center gap-2 mt-1.5 text-xs text-stone/70 cursor-pointer">
                    <input type="checkbox" checked={isLeapMonth} onChange={(e) => setIsLeapMonth(e.target.checked)} className="accent-gold" />
                    該月為閏月
                  </label>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={resetForm}
                  className="flex-1 py-2.5 min-h-[44px] rounded-sm text-sm text-stone border border-gold/10 hover:bg-gold/5 transition-colors font-serif tracking-widest"
                >
                  返回
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !label.trim()}
                  className="flex-1 py-2.5 min-h-[44px] rounded-sm text-sm text-gold border border-gold/20 bg-gold/10 hover:bg-gold/20 transition-colors font-serif tracking-widest disabled:opacity-50"
                >
                  {saving ? "儲存中..." : "儲存"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded border border-gold/10"
                  style={{ background: "rgba(var(--glass-rgb), 0.02)" }}
                >
                  <div>
                    <span className="text-sm text-cream font-serif">{p.label}</span>
                    {p.birthDate && (
                      <span className="text-xs text-stone/50 ml-2">{p.birthDate}</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(p)}
                      className="text-xs text-gold-dim hover:text-gold transition-colors px-2 py-1 min-h-[32px]"
                    >
                      編輯
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(p.id)}
                      className="text-xs text-stone/40 hover:text-red-seal transition-colors px-2 py-1 min-h-[32px]"
                    >
                      刪除
                    </button>
                  </div>
                </div>
              ))}

              {profiles.length < 10 && (
                <button
                  onClick={startAdd}
                  className="w-full py-2.5 min-h-[44px] rounded-sm text-sm text-gold-dim border border-dashed border-gold/15 hover:border-gold/30 hover:text-gold transition-colors font-serif tracking-widest"
                >
                  + 新增檔案
                </button>
              )}

              <div className="pt-3">
                <button
                  onClick={onClose}
                  className="w-full py-2.5 min-h-[44px] rounded-sm text-sm text-stone border border-gold/10 hover:bg-gold/5 transition-colors font-serif tracking-widest"
                >
                  關閉
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteConfirm}
        title="刪除檔案"
        message="確定要刪除這筆資料嗎？已保存的命盤數據也會一併刪除。"
        confirmLabel="刪除"
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
