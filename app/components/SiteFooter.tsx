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
            ? "absolute bottom-4 left-0 right-0 z-10 text-center text-sm text-text-tertiary"
            : "relative z-10 py-5 px-4 text-center text-sm text-text-tertiary border-t border-border-light"
        }
      >
        <div className="mx-auto w-16 tesla-divider mb-3" />
        <Link href="/terms" className="text-text-tertiary hover:text-accent transition-colors">
          {t("footer.terms")}
        </Link>
        <span className="mx-2 text-text-placeholder">·</span>
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          className="text-text-tertiary hover:text-accent transition-colors"
        >
          {t("footer.feedback")}
        </button>
      </footer>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
