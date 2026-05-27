import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://ai-sns-partner.vercel.app",
  ),
  title: "AI SNS Partner | 小規模事業者向けAI SNS運用代行",
  description:
    "投稿企画・原稿作成・投稿代行・月次レポートまで対応。AIと人の確認を組み合わせ、小規模事業者のSNS運用を継続的に支援します。",
  openGraph: {
    title: "AI SNS Partner | 小規模事業者向けAI SNS運用代行",
    description:
      "投稿企画・原稿作成・投稿代行・月次レポートまで対応。AIと人の確認を組み合わせ、小規模事業者のSNS運用を継続的に支援します。",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI SNS Partner | 小規模事業者向けAI SNS運用代行",
    description:
      "投稿企画・原稿作成・投稿代行・月次レポートまで対応。AIと人の確認を組み合わせ、小規模事業者のSNS運用を継続的に支援します。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${notoSansJp.variable} ${inter.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full bg-background text-main">{children}</body>
    </html>
  );
}
