import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import ThemeProvider from "./components/ThemeProvider";
import LocaleProvider from "./components/LocaleProvider";
import SessionProvider from "./components/SessionProvider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f0e0c" },
    { media: "(prefers-color-scheme: light)", color: "#f8f4ec" },
  ],
};

export const metadata: Metadata = {
  title: "天機 — 命理推算",
  description: "結合八字、紫微斗數與西洋星座的 AI 命理分析",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "天機",
  },
  formatDetection: {
    telephone: false,
  },
};

const themeScript = `
try {
  var t = localStorage.getItem('theme');
  if (t === 'light' || t === 'dark') {
    document.documentElement.dataset.theme = t;
  } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
    document.documentElement.dataset.theme = 'light';
  }
  var l = localStorage.getItem('locale');
  if (l) document.documentElement.lang = l;
} catch(e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <SessionProvider>
          <ThemeProvider><LocaleProvider>{children}</LocaleProvider></ThemeProvider>
        </SessionProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
