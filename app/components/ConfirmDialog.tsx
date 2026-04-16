"use client";

import { useLocale } from "./LocaleProvider";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useLocale();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div
        className="relative w-full max-w-sm p-6 rounded-lg border border-border-light animate-fade-in"
        style={{ background: "var(--bg-primary)", animationDuration: "0.3s" }}
      >
        <h3 className="text-base text-accent mb-2">
          {title}
        </h3>
        <p className="text-sm text-text-tertiary leading-relaxed mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 min-h-[44px] rounded-sm text-sm text-text-tertiary border border-border-light hover:bg-bg-secondary transition-colors"
          >
            {cancelLabel ?? t("dialog.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 min-h-[44px] rounded-sm text-sm text-accent border border-accent/20 bg-accent/10 hover:bg-accent/20 transition-colors"
          >
            {confirmLabel ?? t("dialog.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
