"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bus, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OverlayScrollbar } from "@/components/ui/overlay-scrollbar";
import { getAuthUser, type AuthUser } from "@/lib/auth";
import { getSystemTitle } from "@/lib/site-settings";

/**
 * 主頁（/）：
 *  - 已登入 → 顯示站名，並給出「開始打卡」CTA 直達 /scan-in
 *  - 已通過站點密碼但尚未登入 → 送 /login (中介層已保證通過 bus_site_access)
 *  - 從未通過站點密碼 → 由 middleware 自動送 /lock，這裡不會進入
 */
export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [systemTitle, setSystemTitle] = useState("校巴安全打卡系統");

  // 家長追蹤 popup state
  const [showDevPopup, setShowDevPopup] = useState(false);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const u = getAuthUser();
    setUser(u);
    setAuthChecked(true);
    setSystemTitle(getSystemTitle());
    if (!u) {
      // 已通過站點密碼 cookie (否則 middleware 早就送 /lock 了)。
      // 這裡只是尚未登入 → 直接送往 /login，不要清空站點密碼 cookie。
      router.replace("/login");
    }
  }, [router]);

  // 監聽站台設定變更，即時更新標題
  useEffect(() => {
    const onChange = () => setSystemTitle(getSystemTitle());
    window.addEventListener("bus-site-settings-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("bus-site-settings-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  // 清理計時器，防止組件卸載後仍觸發
  useEffect(() => {
    return () => {
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    };
  }, []);

  function handleTrackingClick() {
    if (user?.role === "admin") {
      router.push("/student");
      return;
    }
    // 非 admin：顯示「功能開發中」popup
    setShowDevPopup(true);
    popupTimerRef.current = setTimeout(() => {
      setShowDevPopup(false);
    }, 2500);
  }

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
    <main className="relative flex h-svh w-full flex-col bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      {/* 裝飾背景 */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 right-[-120px] h-[420px] w-[420px] rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute bottom-[-160px] left-[-100px] h-[360px] w-[360px] rounded-full bg-sky-200/40 blur-3xl" />
      </div>

      <OverlayScrollbar className="flex-1">
        <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">

      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-8">
        {/* Hero */}
        <section className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-xl">
            <Bus className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {systemTitle}
          </h1>
        </section>

        {/* 打卡 CTA */}
        <section className="w-full">
          <Button
            asChild
            size="lg"
            className="w-full bg-slate-900 hover:bg-slate-800"
          >
            <Link href="/scan-in">
              開始打卡系統
              <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </section>

        {/* 家長即時追蹤入口 */}
        <section className="w-full">
          <Button
            size="lg"
            className="w-full bg-slate-900 hover:bg-slate-800"
            onClick={handleTrackingClick}
          >
            家長即時追蹤
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </section>
      </div>
        </div>
      </OverlayScrollbar>

      {/* 功能開發中 popup */}
      <div
        aria-live="polite"
        className={`fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-2xl transition-all duration-300 ${
          showDevPopup
            ? "translate-y-0 opacity-100"
            : "translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
            <span className="text-xl">🔧</span>
          </div>
          <p className="text-sm font-semibold text-slate-900">功能開發中</p>
          <p className="text-xs text-slate-500">家長即時追蹤功能現正積極開發，敬請期待！</p>
        </div>
      </div>
    </main>
  );
}
