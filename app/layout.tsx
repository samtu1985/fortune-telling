import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import ThemeProvider from "./components/ThemeProvider";
import LocaleProvider from "./components/LocaleProvider";
import LocaleChangeToast from "./components/LocaleChangeToast";
import FontSizeProvider from "./components/FontSizeProvider";
import SessionProvider from "./components/SessionProvider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#171A20" },
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
  ],
};

const SITE_URL = "https://fortunefor.me";
const SITE_NAME = "天機";
const DEFAULT_TITLE = "天機 — 命理推算";
const DEFAULT_DESCRIPTION = "結合八字、紫微斗數與西洋星座的 AI 命理分析";
const OG_IMAGE = "/icon-512.png";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: "%s｜天機",
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  manifest: "/manifest.json",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    locale: "zh_TW",
    images: [{ url: OG_IMAGE, width: 512, height: 512, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
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
    title: SITE_NAME,
  },
  formatDetection: {
    telephone: false,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/icon-512.png`,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}#website`,
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: ["zh-Hant", "zh-Hans", "en", "ja"],
      publisher: { "@id": `${SITE_URL}#organization` },
    },
    {
      "@type": "WebApplication",
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Web",
      description: DEFAULT_DESCRIPTION,
      offers: { "@type": "Offer", price: "0", priceCurrency: "TWD" },
    },
  ],
};

const themeScript = `
try {
  var t = localStorage.getItem('theme');
  if (t === 'light' || t === 'dark') {
    document.documentElement.dataset.theme = t;
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.dataset.theme = 'dark';
  }
  var l = localStorage.getItem('locale');
  if (l) document.documentElement.lang = l;
  var f = localStorage.getItem('fontSize');
  if (f === 'large') document.documentElement.dataset.fontsize = 'large';
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <SessionProvider>
          <ThemeProvider><LocaleProvider><FontSizeProvider>{children}<LocaleChangeToast /></FontSizeProvider></LocaleProvider></ThemeProvider>
        </SessionProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
