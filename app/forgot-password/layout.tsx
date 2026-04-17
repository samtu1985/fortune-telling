import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "忘記密碼",
  description: "重設「天機」帳號密碼。",
  alternates: { canonical: "/forgot-password" },
  robots: { index: false, follow: true },
  openGraph: {
    title: "忘記密碼｜天機",
    description: "重設「天機」帳號密碼。",
    url: "/forgot-password",
  },
  twitter: {
    title: "忘記密碼｜天機",
    description: "重設「天機」帳號密碼。",
  },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
