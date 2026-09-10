"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bus, ChevronRight, Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAuthUser, type AuthUser } from "@/lib/auth";

/**
 * 主頁（/）：
 *  - 已登入 → 顯示站名、歡迎語，並給出「開始打卡」CTA 直達 /scan
 *  - 已通過站點密碼但尚未登入 → 送 /login (中介層已保證通過 bus_site_access)
 *  - 從未通過站點密碼 → 由 middleware 自動送 /lock，這裡不會進入
 */
export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const u = getAuthUser();
    setUser(u);
    setAuthChecked(true);
    if (!u) {
      // 已通過站點密碼 cookie (否則 middleware 早就送 /lock 了)。
      // 這裡只是尚未登入 → 直接送往 /login，不要清空站點密碼 cookie。
      router.replace("/login");
    }
  }, [router]);

  if (!authChecked || !user) {
    return (
      <main className="flex h-svh w-full flex-col items-center justify-center bg-slate-50 text-slate-500">
        <Bus className="mb-3 h-10 w-10 text-slate-700" />
        <Loader2 className="h-5 w-5 animate-spin" />
        <p className="mt-3 text-xs">載入中…</p>
      </main>
    );
  }

  return (
    <main className="relative flex h-svh w-full flex-col items-center justify-center overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-emerald-50 px-4 py-10">
      {/* 裝飾背景 */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 right-[-120px] h-[420px] w-[420px] rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute bottom-[-160px] left-[-100px] h-[360px] w-[360px] rounded-full bg-sky-200/40 blur-3xl" />
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-10">
        {/* Hero */}
        <section className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-xl">
            <Bus className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            校巴安全打卡系統
          </h1>
          <p className="mt-2 text-sm text-slate-500 sm:text-base">
            School Bus Check-in · Realtime Tracking
          </p>
          <p className="mt-3 rounded-full bg-emerald-50 px-4 py-1 text-xs font-medium text-emerald-700">
            歡迎回來，{user.name}
          </p>
        </section>

        {/* CTA */}
        <section className="w-full rounded-2xl border border-white/40 bg-white/60 p-6 text-center shadow-xl backdrop-blur-2xl backdrop-saturate-150 sm:p-8">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 sm:text-lg">開始打卡</h2>
              <p className="text-xs text-slate-500">使用後置鏡頭掃描學生 QR Code 完成上落車</p>
            </div>
          </div>
          <Button asChild size="lg" className="mt-5 w-full bg-slate-900 hover:bg-slate-800">
            <Link href="/scan">
              開始打卡系統
              <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </section>
      </div>
    </main>
  );
}
