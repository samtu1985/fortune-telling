"use client";

import {
  useState,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import PurchaseModal from "./PurchaseModal";
import ThanksForTryingModal from "./ThanksForTryingModal";

type Ctx = {
  trigger: (canPurchase: boolean) => void;
};

const QuotaExhaustedContext = createContext<Ctx | null>(null);

export function useQuotaExhausted(): Ctx {
  const ctx = useContext(QuotaExhaustedContext);
  if (!ctx) {
    throw new Error(
      "useQuotaExhausted must be used within QuotaExhaustedProvider"
    );
  }
  return ctx;
}

export function QuotaExhaustedProvider({
  userId,
  children,
}: {
  userId: number;
  children: ReactNode;
}) {
  const [mode, setMode] = useState<"none" | "purchase" | "thanks">("none");

  const trigger = useCallback((canPurchase: boolean) => {
    setMode(canPurchase ? "purchase" : "thanks");
  }, []);

  const close = useCallback(() => setMode("none"), []);

  return (
    <QuotaExhaustedContext.Provider value={{ trigger }}>
      {children}
      {mode === "purchase" && <PurchaseModal userId={userId} onClose={close} />}
      {mode === "thanks" && <ThanksForTryingModal onClose={close} />}
    </QuotaExhaustedContext.Provider>
  );
}
