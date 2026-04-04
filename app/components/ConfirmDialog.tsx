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
        className="relative w-full max-w-sm p-6 rounded-lg border border-gold/20 animate-fade-in-up"
        style={{ background: "var(--parchment)", animationDuration: "0.3s" }}
      >
        <h3 className="font-serif text-base text-gold tracking-wide mb-2">
          {title}
        </h3>
        <p className="text-sm text-stone/80 leading-relaxed mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 min-h-[44px] rounded-sm text-sm text-stone border border-gold/10 hover:bg-gold/5 transition-colors font-serif tracking-widest"
          >
            {cancelLabel ?? t("dialog.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 min-h-[44px] rounded-sm text-sm text-gold border border-gold/20 bg-gold/10 hover:bg-gold/20 transition-colors font-serif tracking-widest"
          >
            {confirmLabel ?? t("dialog.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
