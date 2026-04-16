"use client";

import { useState, useEffect } from "react";
import { useLocale } from "./LocaleProvider";

interface SendTrialModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SendTrialModal({ open, onClose }: SendTrialModalProps) {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [singleCredits, setSingleCredits] = useState(10);
  const [multiCredits, setMultiCredits] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"credited" | "pending" | "error" | null>(null);

  // Fetch default credit settings
  useEffect(() => {
    if (open) {
      fetch("/api/admin/credit-settings")
        .then((r) => r.json())
        .then((data) => {
          if (data.defaultSingleRounds) setSingleCredits(data.defaultSingleRounds);
          if (data.defaultMultiSessions) setMultiCredits(data.defaultMultiSessions);
        })
        .catch(() => {});
    }
  }, [open]);

  const handleSend = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/credits/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), singleCredits, multiCredits }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data.status === "credited" ? "credited" : "pending");
        setEmail("");
      } else {
        setResult("error");
      }
    } catch {
      setResult("error");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setEmail("");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-sm mx-4 rounded-lg border border-border-light p-6"
        style={{ background: "var(--bg-secondary)" }}
      >
        <h3 className="text-sm text-accent mb-4">{t("trial.title")}</h3>

        {result ? (
          <div className="space-y-4">
            <p className={`text-sm ${result === "error" ? "text-red-400" : "text-green-500"}`}>
              {result === "credited"
                ? t("trial.successCredited")
                : result === "pending"
                ? t("trial.successPending")
                : t("trial.error")}
            </p>
            <button
              onClick={handleClose}
              className="w-full py-2 text-xs border border-accent/30 rounded-sm text-accent hover:bg-accent/10 transition-colors"
            >
              {t("trial.close")}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-text-tertiary mb-1 block">{t("trial.email")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("trial.emailPlaceholder")}
                className="w-full"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-tertiary mb-1 block">{t("trial.singleCredits")}</label>
                <input
                  type="number"
                  min={0}
                  value={singleCredits}
                  onChange={(e) => setSingleCredits(parseInt(e.target.value) || 0)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs text-text-tertiary mb-1 block">{t("trial.multiCredits")}</label>
                <input
                  type="number"
                  min={0}
                  value={multiCredits}
                  onChange={(e) => setMultiCredits(parseInt(e.target.value) || 0)}
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="flex-1 py-2 text-xs text-text-tertiary hover:text-text-primary transition-colors"
              >
                {t("trial.close")}
              </button>
              <button
                onClick={handleSend}
                disabled={loading || !email.trim()}
                className="flex-1 py-2 text-xs border border-accent/30 rounded-sm text-accent hover:bg-accent/10 transition-colors disabled:opacity-40"
              >
                {loading ? t("trial.sending") : t("trial.send")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
