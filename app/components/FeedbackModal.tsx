"use client";

import { useState, useEffect, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useLocale } from "./LocaleProvider";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function FeedbackModal({ open, onClose }: Props) {
  const { t } = useLocale();
  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // Pre-fill when logged in and modal opens
  useEffect(() => {
    if (open) {
      if (session?.user) {
        setName(session.user.name || "");
        setEmail(session.user.email || "");
      }
      setStatus("idle");
      setErrorMessage("");
    }
  }, [open, session]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;
    setLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error || t("feedback.errorGeneric"));
        setStatus("error");
        return;
      }
      setStatus("success");
      setMessage("");
      // Auto-close after short delay
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch {
      setErrorMessage(t("feedback.errorGeneric"));
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-up"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", animationDuration: "200ms" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-lg border border-gold/20 shadow-2xl"
        style={{ background: "var(--parchment)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gold/10">
          <h2 className="text-base text-gold font-serif tracking-wide">
            {t("feedback.title")}
          </h2>
          <button
            onClick={onClose}
            className="text-stone/50 hover:text-cream transition-colors w-6 h-6 flex items-center justify-center"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        {status === "success" ? (
          <div className="px-5 py-10 text-center">
            <div className="inline-block w-12 h-12 rounded-full border border-green-500/30 bg-green-500/10 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-cream font-serif">{t("feedback.successTitle")}</p>
            <p className="text-xs text-stone/60 mt-1">{t("feedback.successBody")}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
            <p className="text-xs text-stone/60 leading-relaxed">
              {t("feedback.description")}
            </p>

            <div>
              <label className="block text-xs text-stone/70 mb-1">
                {t("feedback.nameLabel")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={255}
                disabled={loading}
                className="w-full px-3 py-2 text-sm border border-gold/20 rounded text-cream placeholder:text-stone/30 focus:border-gold/50 focus:outline-none"
                style={{ backgroundColor: "rgba(var(--glass-rgb), 0.02)" }}
              />
            </div>

            <div>
              <label className="block text-xs text-stone/70 mb-1">
                {t("feedback.emailLabel")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
                disabled={loading}
                className="w-full px-3 py-2 text-sm border border-gold/20 rounded text-cream placeholder:text-stone/30 focus:border-gold/50 focus:outline-none"
                style={{ backgroundColor: "rgba(var(--glass-rgb), 0.02)" }}
              />
            </div>

            <div>
              <label className="block text-xs text-stone/70 mb-1">
                {t("feedback.messageLabel")}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={5}
                maxLength={4000}
                disabled={loading}
                placeholder={t("feedback.messagePlaceholder")}
                className="w-full px-3 py-2 text-sm border border-gold/20 rounded text-cream placeholder:text-stone/30 focus:border-gold/50 focus:outline-none resize-none"
                style={{ backgroundColor: "rgba(var(--glass-rgb), 0.02)" }}
              />
              <p className="text-[10px] text-stone/40 text-right mt-0.5">
                {message.length} / 4000
              </p>
            </div>

            {errorMessage && (
              <p className="text-xs text-red-400">{errorMessage}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-xs text-stone border border-stone/30 rounded hover:bg-stone/10 transition-colors disabled:opacity-50"
              >
                {t("feedback.cancel")}
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim() || !email.trim() || !message.trim()}
                className="px-4 py-2 text-xs text-gold border border-gold/30 rounded hover:bg-gold/10 transition-colors disabled:opacity-40"
              >
                {loading ? (
                  <span className="inline-block w-3 h-3 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                ) : (
                  t("feedback.submit")
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
