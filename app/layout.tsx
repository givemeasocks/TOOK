import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TOOK — 툭",
  description: "아무 때나 툭 던져두세요. 필요할 때 제가 알아서 짠 꺼내드릴게요.",
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
