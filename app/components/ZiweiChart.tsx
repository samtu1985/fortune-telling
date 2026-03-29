"use client";

import { Component, type ReactNode } from "react";
import dynamic from "next/dynamic";

// react-iztro imports CSS files, must be loaded client-side only
const Iztrolabe = dynamic(
  () => import("react-iztro").then((mod) => mod.Iztrolabe),
  { ssr: false }
);

interface ZiweiChartProps {
  birthday: string; // YYYY-M-D format
  birthTime: number; // 0-12 時辰 index
  gender: "男" | "女";
  birthdayType: "lunar" | "solar";
}

class ZiweiChartErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[ZiweiChart] render error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="my-4 rounded-lg border border-gold/20 p-6 text-center text-sm text-stone/60">
          命盤圖表載入失敗，但不影響 AI 解讀結果。
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ZiweiChart({
  birthday,
  birthTime,
  gender,
  birthdayType,
}: ZiweiChartProps) {
  return (
    <ZiweiChartErrorBoundary>
      <div className="my-4 rounded-lg border border-gold/20 overflow-hidden">
        <Iztrolabe
          birthday={birthday}
          birthTime={birthTime}
          gender={gender}
          birthdayType={birthdayType}
          lang="zh-TW"
          width="100%"
        />
      </div>
    </ZiweiChartErrorBoundary>
  );
}
