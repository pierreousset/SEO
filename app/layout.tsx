import type { Metadata } from "next";
import { Caveat, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { LocaleProvider } from "@/components/locale-provider";
import "./globals.css";

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
    default: "SEO Dashboard — Your AI SEO Coach",
    template: "%s | SEO Dashboard",
  },
  description:
    "Stop staring at data. Start getting results. AI-powered SEO coach that tells you what to fix, in what order, and why. Indie alternative to Semrush at 15€/mo.",
  keywords: [
    "SEO",
    "SEO dashboard",
    "SEO tool",
    "rank tracking",
    "AI SEO",
    "keyword tracking",
    "site audit",
    "alternative semrush",
  ],
  authors: [{ name: "240 Company" }],
  creator: "240 Company",
  openGraph: {
    title: "SEO Dashboard — Your AI SEO Coach",
    description:
      "AI-powered SEO coaching. Health score, issue detection, keyword tracking, AI briefs. 15€/mo.",
    type: "website",
    locale: "fr_FR",
    alternateLocale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "SEO Dashboard — Your AI SEO Coach",
    description:
      "AI-powered SEO coaching. Health score, issue detection, keyword tracking, AI briefs.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: { icon: "/favicon.svg" },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${caveat.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-canvas-white text-ink-black">
        <LocaleProvider>{children}</LocaleProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
