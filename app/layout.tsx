import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = "https://web-eight-alpha-32.vercel.app";
const TITLE = "TOOK — 툭";
const DESCRIPTION = "아무 때나 툭 던져두세요. 필요할 때 제가 알아서 짠 꺼내드릴게요.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TOOK",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "TOOK",
    locale: "ko_KR",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#C97F4A",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
