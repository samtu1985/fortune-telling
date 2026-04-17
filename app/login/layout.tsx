import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "登入",
  description: "登入「天機」以使用八字、紫微斗數與西洋星座 AI 命理分析。",
  alternates: { canonical: "/login" },
  openGraph: {
    title: "登入｜天機",
    description: "登入「天機」以使用 AI 命理分析服務。",
    url: "/login",
  },
  twitter: {
    title: "登入｜天機",
    description: "登入「天機」以使用 AI 命理分析服務。",
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
