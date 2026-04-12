"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "./LocaleProvider";
import FeedbackModal from "./FeedbackModal";

interface Props {
  /** Layout variant: "block" for normal flow, "absolute" for pinned positioning */
  variant?: "block" | "absolute";
}

export default function SiteFooter({ variant = "block" }: Props) {
  const { t } = useLocale();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <>
      <footer
        className={
          variant === "absolute"
            ? "absolute bottom-4 left-0 right-0 z-10 text-center text-sm text-stone/70"
            : "relative z-10 py-5 px-4 text-center text-sm text-stone/70 border-t border-gold/10"
        }
      >
        <div className="mx-auto w-16 gold-line mb-3" />
        <Link href="/terms" className="text-stone/70 hover:text-gold transition-colors">
          {t("footer.terms")}
        </Link>
        <span className="mx-2 text-stone/40">·</span>
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          className="text-stone/70 hover:text-gold transition-colors"
        >
          {t("footer.feedback")}
        </button>
      </footer>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
