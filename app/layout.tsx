import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TOOK — 툭",
  description: "툭 던져두면, 필요할 때 알아서 나타나는 개인 아카이브",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TOOK",
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
