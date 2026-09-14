import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { BottomNav } from "@/components/ui/bottom-nav";
import { SiteAccessProvider } from "@/components/site-access-provider";
import { I18nProvider } from "@/components/i18n-provider";

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
      <body className="min-h-svh w-full overflow-x-hidden bg-slate-50 font-sans antialiased">
        {/* w-full: 避免 w-screen (100vw) 在 Windows 滾動條環境下多出 15px 造成水平溢出。
            overflow-x-hidden: 兜底防止任何子層意外的水平溢出。 */}
        <SiteAccessProvider>
          <I18nProvider>
            <Toaster>
              {/* 全局容器：使用 min-h-svh 兼顧手機 PWA 與桌面瀏覽器，讓子元素的
                  `h-full` 能透過 100% 解析到實際高度。 */}
              <div className="flex min-h-svh w-full flex-col safe-top safe-bottom">
                {children}
              </div>
              {/* 底部 Liquid Glass 浮動導覽列 (在 /lock 與 /login 自動隱藏) */}
              <BottomNav />
            </Toaster>
          </I18nProvider>
        </SiteAccessProvider>
      </body>
    </html>
  );
}
