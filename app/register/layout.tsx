import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "建立帳號",
  description: "註冊「天機」帳號，開始使用 AI 驅動的八字、紫微斗數與星座命盤分析。",
  alternates: { canonical: "/register" },
  openGraph: {
    title: "建立帳號｜天機 AI 命理",
    description: "註冊「天機」帳號，開始探索你的命盤。",
    url: "/register",
  },
  twitter: {
    title: "建立帳號｜天機 AI 命理",
    description: "註冊「天機」帳號，開始探索你的命盤。",
  },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
