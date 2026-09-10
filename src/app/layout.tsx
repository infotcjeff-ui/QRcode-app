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
      <body className="h-screen overflow-hidden bg-slate-50 font-sans antialiased">
        <Toaster>
          <main className="flex h-full w-full items-center justify-center">
            {children}
          </main>
        </Toaster>
      </body>
    </html>
  );
}