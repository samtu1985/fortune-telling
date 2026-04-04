"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { type Locale, DEFAULT_LOCALE, t } from "@/app/lib/i18n";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
});

export function useLocale() {
  return useContext(LocaleContext);
}

export default function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const stored = localStorage.getItem("locale") as Locale | null;
    if (stored && ["zh-Hant", "zh-Hans", "en", "ja"].includes(stored)) {
      setLocaleState(stored);
      document.documentElement.lang = stored;
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem("locale", next);
    document.documentElement.lang = next;
  }, []);

  const translate = useCallback(
    (key: string, params?: Record<string, string>) => t(locale, key, params),
    [locale],
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t: translate }}>
      {children}
    </LocaleContext.Provider>
  );
}
