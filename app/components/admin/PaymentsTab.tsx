"use client";

import { useState } from "react";
import PackagesAdmin from "./PackagesAdmin";
import RevenueDashboard from "./RevenueDashboard";

type SubTab = "packages" | "revenue";

export default function PaymentsTab() {
  const [sub, setSub] = useState<SubTab>("packages");

  return (
    <div>
      <div className="mb-6 flex gap-6 border-b border-gold/30">
        <button
          type="button"
          onClick={() => setSub("packages")}
          className={`pb-3 font-serif transition-colors ${
            sub === "packages"
              ? "border-b-2 border-gold text-gold"
              : "text-mist hover:text-gold"
          }`}
        >
          方案管理
        </button>
        <button
          type="button"
          onClick={() => setSub("revenue")}
          className={`pb-3 font-serif transition-colors ${
            sub === "revenue"
              ? "border-b-2 border-gold text-gold"
              : "text-mist hover:text-gold"
          }`}
        >
          收入與交易
        </button>
      </div>
      {sub === "packages" ? <PackagesAdmin /> : <RevenueDashboard />}
    </div>
  );
}
