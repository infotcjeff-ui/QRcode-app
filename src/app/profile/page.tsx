"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bus, Loader2, LogOut, Settings, ShieldCheck, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast-context";
import {
  clearAuthUser,
  clearSiteAccessCookie,
  ROLE_LABEL,
  type AuthUser,
} from "@/lib/auth";

type LoadedUser = AuthUser | null;

const INITIAL: LoadedUser = null;

export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<LoadedUser>(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const u = typeof window !== "undefined" ? readUser() : null;
    if (!u) {
      // 未登入 → 回到 /lock
      router.replace("/lock");
      return;
    }
    setUser(u);
  }, [router]);

  function readUser(): LoadedUser {
    try {
      const raw = window.localStorage.getItem("bus-auth-user");
      if (!raw) return null;
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  function handleLogout() {
    if (submitting) return;
    setSubmitting(true);
    clearAuthUser();
    clearSiteAccessCookie();
    toast({
      title: "已登出",
      description: "請重新輸入網站密碼以繼續使用。",
      duration: 3000,
    });
    setTimeout(() => {
      router.replace("/lock");
    }, 200);
  }

  if (user === INITIAL) {
    return (
      <main className="flex w-full items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </main>
    );
  }
  if (user === null) return null;

  const isAdmin = user.role === "admin";

  return (
    <main className="relative flex w-full flex-col bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute bottom-[-160px] right-[-120px] h-[320px] w-[320px] rounded-full bg-sky-200/30 blur-3xl" />
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10 sm:py-12">
        {/* Header */}
        <header className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-xl">
            <Bus className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            個人資料
          </h1>
          <p className="mt-1 text-xs text-slate-500">School Bus Check-in · 帳號中心</p>
        </header>

        {/* User Card */}
        <Card className="border-white/40 bg-white/60 shadow-xl backdrop-blur-2xl backdrop-saturate-150">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-sky-500 text-lg font-bold text-white">
              {user.name?.slice(0, 1) ?? "?"}
            </div>
            <div className="flex flex-col">
              <span className="text-base font-semibold text-slate-900">{user.name}</span>
              <span className="text-xs text-slate-500">
                {ROLE_LABEL[user.role]}{user.phone ? ` · ${user.phone}` : ""}
              </span>
              <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full bg-slate-900/5 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                <ShieldCheck className="h-3 w-3" /> {user.role.toUpperCase()}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Menu Items */}
        <div className="flex flex-col gap-3">
          {/* 系統設定 (僅 admin 可見) */}
          {isAdmin ? (
            <Button
              asChild
              size="lg"
              className="h-14 w-full justify-between bg-slate-900 px-5 text-base hover:bg-slate-800"
            >
              <Link href="/system-setting">
                <span className="flex items-center gap-3">
                  <Settings className="h-5 w-5" />
                  系統設定
                </span>
                <span className="text-xs text-slate-300">Admin only</span>
              </Link>
            </Button>
          ) : null}

          {/* 個人資料 (佔位，未來擴充) */}
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-14 w-full justify-between border-white/40 bg-white/60 px-5 text-base text-slate-700 hover:bg-white/80"
            onClick={() =>
              toast({
                title: "個人資料",
                description: "目前僅顯示於此頁面，未來可在此編輯姓名/電話。",
                duration: 3500,
              })
            }
          >
            <span className="flex items-center gap-3">
              <UserIcon className="h-5 w-5" />
              個人資料
            </span>
            <span className="text-xs text-slate-400">查看詳情</span>
          </Button>

          {/* 登出 */}
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-14 w-full justify-center gap-3 border-red-300 bg-red-50 px-5 text-base text-red-700 hover:bg-red-100"
            onClick={handleLogout}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <LogOut className="h-5 w-5" />
            )}
            登出
          </Button>
        </div>

        <p className="mt-auto text-center text-[11px] text-slate-400">
          此頁面僅供授權人員使用。所有連線會被記錄。
        </p>
      </div>
    </main>
  );
}
