"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type FontSize = "normal" | "large";

interface FontSizeContextValue {
  fontSize: FontSize;
  toggleFontSize: () => void;
}

const FontSizeContext = createContext<FontSizeContextValue>({
  fontSize: "normal",
  toggleFontSize: () => {},
});

export function useFontSize() {
  return useContext(FontSizeContext);
}

export default function FontSizeProvider({ children }: { children: React.ReactNode }) {
  const [fontSize, setFontSize] = useState<FontSize>("normal");

  useEffect(() => {
    const stored = localStorage.getItem("fontSize") as FontSize | null;
    if (stored === "large") {
      setFontSize("large");
      document.documentElement.dataset.fontsize = "large";
    }
  }, []);

  const toggleFontSize = useCallback(() => {
    setFontSize((prev) => {
      const next = prev === "normal" ? "large" : "normal";
      localStorage.setItem("fontSize", next);
      if (next === "large") {
        document.documentElement.dataset.fontsize = "large";
      } else {
        delete document.documentElement.dataset.fontsize;
      }
      return next;
    });
  }, []);

  return (
    <FontSizeContext.Provider value={{ fontSize, toggleFontSize }}>
      {children}
    </FontSizeContext.Provider>
  );
}
