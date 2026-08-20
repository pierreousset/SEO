import type { Metadata } from "next";
import localFont from "next/font/local";
import { Caveat, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { LocaleProvider } from "@/components/locale-provider";
import { getLocale } from "@/lib/i18n-server";
import "./globals.css";

const openRunde = localFont({
  src: [
    { path: "../public/fonts/open-runde/OpenRunde-Regular.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/open-runde/OpenRunde-Medium.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/open-runde/OpenRunde-Semibold.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/open-runde/OpenRunde-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-open-runde",
  display: "swap",
  adjustFontFallback: false,
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["600"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.BETTER_AUTH_URL ?? "https://seo.240company.com"),
  title: {
    default: "SEO Dashboard — Quoi corriger, dans quel ordre",
    template: "%s | SEO Dashboard",
  },
  description:
    "Coach SEO branché sur Search Console. Brief hebdo, audit, suivi de positions. 99€/mois après un free sans carte. Par 240 Company.",
  keywords: [
    "SEO",
    "coach SEO",
    "Search Console",
    "audit SEO",
    "suivi de positions",
    "brief SEO",
  ],
  authors: [{ name: "240 Company" }],
  creator: "240 Company",
  openGraph: {
    title: "SEO Dashboard — Quoi corriger, dans quel ordre",
    description:
      "Coach SEO branché sur Search Console. Brief hebdo, audit, suivi. 99€/mois.",
    type: "website",
    locale: "fr_FR",
    alternateLocale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "SEO Dashboard — Quoi corriger, dans quel ordre",
    description:
      "Coach SEO branché sur Search Console. Brief hebdo, audit, suivi. 99€/mois.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: { icon: "/favicon.svg" },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lng = await getLocale();

  return (
    <html
      lang={lng}
      className={`${openRunde.variable} ${openRunde.className} ${caveat.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-ink-black">
        <LocaleProvider>{children}</LocaleProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
