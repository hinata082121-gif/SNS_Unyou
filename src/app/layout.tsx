import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Noto_Sans_JP } from "next/font/google";
import { GoogleAnalytics } from "@/components/google-analytics";
import { SITE_LABEL, SITE_NAME, SITE_URL } from "@/lib/site";
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
  metadataBase: new URL(SITE_URL),
  title: `${SITE_NAME} | ${SITE_LABEL}`,
  description:
    "投稿企画・原稿作成・投稿代行・月次レポートまで対応。小規模事業者のSNS運用を継続的に支援します。",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${SITE_NAME} | ${SITE_LABEL}`,
    description:
      "投稿企画・原稿作成・投稿代行・月次レポートまで対応。小規模事業者のSNS運用を継続的に支援します。",
    url: "/",
    siteName: SITE_NAME,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: SITE_NAME,
      },
    ],
    type: "website",
    locale: "ja_JP",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | ${SITE_LABEL}`,
    description:
      "投稿企画・原稿作成・投稿代行・月次レポートまで対応。小規模事業者のSNS運用を継続的に支援します。",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
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
      <body className="min-h-full bg-background text-primary">
        {children}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
