"use client";

import Link from "next/link";
import { useLocale } from "@/app/components/LocaleProvider";
import LocaleSwitcher from "@/app/components/LocaleSwitcher";
import ThemeToggle from "@/app/components/ThemeToggle";
import SmokeParticles from "@/app/components/SmokeParticles";

export default function TermsPage() {
  const { t } = useLocale();

  const sections: { key: string; hasList?: boolean; listCount?: number }[] = [
    { key: "terms.section.intro" },
    { key: "terms.section.ai", hasList: true, listCount: 4 },
    { key: "terms.section.entertainment", hasList: true, listCount: 3 },
    { key: "terms.section.noProfessional" },
    { key: "terms.section.data", hasList: true, listCount: 4 },
    { key: "terms.section.age" },
    { key: "terms.section.geo", hasList: true, listCount: 2 },
    { key: "terms.section.jurisdictions", hasList: true, listCount: 5 },
    { key: "terms.section.liability" },
    { key: "terms.section.changes" },
    { key: "terms.section.contact" },
  ];

  return (
    <main className="relative z-10 min-h-dvh flex flex-col">
      <SmokeParticles />

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gold/10">
        <Link
          href="/"
          className="text-sm text-gold/70 hover:text-gold transition-colors font-serif tracking-wide"
        >
          ← {t("terms.back")}
        </Link>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>

      {/* Content */}
      <article className="relative z-10 max-w-3xl mx-auto w-full px-5 sm:px-8 py-8 sm:py-12 flex-1">
        <h1 className="text-2xl sm:text-3xl text-gold font-serif tracking-wide mb-2">
          {t("terms.title")}
        </h1>
        <p className="text-xs text-stone/50 mb-8">{t("terms.lastUpdated")}</p>

        {sections.map(({ key, hasList, listCount }) => (
          <section key={key} className="mb-8">
            <h2 className="text-base sm:text-lg text-cream font-serif tracking-wide mb-3 border-l-2 border-gold/40 pl-3">
              {t(`${key}.title`)}
            </h2>
            <p className="text-sm text-stone/80 leading-relaxed whitespace-pre-line">
              {t(`${key}.body`)}
            </p>
            {hasList && listCount && (
              <ul className="mt-3 space-y-1.5 text-sm text-stone/75 leading-relaxed">
                {Array.from({ length: listCount }, (_, i) => (
                  <li key={i} className="pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-gold/60">
                    {t(`${key}.item${i + 1}`)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </article>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gold/10 px-6 py-4 text-center text-xs text-stone/40">
        <Link href="/" className="hover:text-gold transition-colors">
          {t("terms.backHome")}
        </Link>
      </footer>
    </main>
  );
}
