import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "校巴安全打卡系統 | School Bus Check-in",
  description: "Mobile-first school bus student check-in and parent tracking system.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-HK" suppressHydrationWarning>
      <body className="min-h-screen w-screen bg-slate-50 font-sans antialiased">
        <Toaster>
          {/*
            全局容器：使用 min-h 取代 h-screen，讓頁面依內容高度自然延長。
            每頁自行決定自身高度 / 滾動行為，並使用 .scrollbar-inset (inset 風格)。
          */}
          <div className="flex min-h-screen w-full flex-col safe-top safe-bottom">
            {children}
          </div>
        </Toaster>
      </body>
    </html>
  );
}
