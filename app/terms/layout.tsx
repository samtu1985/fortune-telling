import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "使用條款與免責聲明",
  description: "「天機」AI 命理服務使用條款、隱私與 AI 生成內容透明性聲明。",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "使用條款與免責聲明｜天機",
    description: "「天機」AI 命理服務使用條款與免責聲明。",
    url: "/terms",
  },
  twitter: {
    title: "使用條款與免責聲明｜天機",
    description: "「天機」AI 命理服務使用條款與免責聲明。",
  },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
