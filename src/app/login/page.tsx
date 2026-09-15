"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bus,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OverlayScrollbar } from "@/components/ui/overlay-scrollbar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast-context";
import {
  ROLE_LABEL,
  setAuthUser,
  type AuthUser,
} from "@/lib/auth";
import { getSystemTitle } from "@/lib/site-settings";
import type { UserRole } from "@/lib/types";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const initialRole =
    (searchParams.get("role") as UserRole | null) === "attendant" ? "attendant" : "admin";

  const [role, setRole] = useState<UserRole>(initialRole);
  const [systemTitle, setSystemTitle] = useState("校巴安全打卡系統");
  const [password, setPassword] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [role, password]);

  useEffect(() => {
    setSystemTitle(getSystemTitle());
    const onChange = () => setSystemTitle(getSystemTitle());
    window.addEventListener("bus-site-settings-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("bus-site-settings-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, password: password.trim() }),
      });

      const json = (await res.json()) as
        | { success: true; user: AuthUser }
        | { success: false; error: string };

      if (!res.ok || !json.success) {
        const errMsg = "error" in json ? json.error : "登入失敗，請再試一次。";
        setError(errMsg);
        return;
      }

      const isDemo = "demo" in json && json.demo === true;

      setAuthUser(json.user);
      toast({
        title: isDemo ? `示範模式 · ${json.user.name}` : `歡迎，${json.user.name}`,
        description: isDemo
          ? `示範身份登入（Supabase 未連線）。${ROLE_LABEL[json.user.role]}功能已解鎖。`
          : `已以 ${ROLE_LABEL[json.user.role]} 身份登入。`,
        duration: 5000,
      });

      const next = searchParams.get("next");
      // 預設登入後進入主頁 (/)，與產品設計一致：
      //   - admin 與 attendant 都先看到主頁，再自行切換功能。
      //   - 若 query 提供 `next=/xxx` 且為站內相對路徑，則尊重原意。
      const dest = next && next.startsWith("/") ? next : "/";
      router.replace(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "網絡錯誤，請稍後再試。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex h-svh w-full flex-col bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      <OverlayScrollbar className="flex-1">
        <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">
          <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
            <Bus className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {systemTitle}
          </h1>
          <p className="mt-1 text-sm text-slate-500">School Bus Check-in · 登入</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <Tabs value={role} onValueChange={(v) => setRole(v as UserRole)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="admin" className="text-sm">
                <ShieldCheck className="mr-1 h-4 w-4" /> 系統管理員
              </TabsTrigger>
              <TabsTrigger value="attendant" className="text-sm">
                <Bus className="mr-1 h-4 w-4" /> 打卡
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">密碼</label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="請輸入密碼"
                  autoFocus
                  className="pl-9"
                />
              </div>
            </div>

            {error ? (
              <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-700">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={submitting || !password.trim()}
              className="w-full"
              size="lg"
            >
              {submitting ? (
                <>
                  <KeyRound className="mr-2 h-4 w-4 animate-spin" />
                  登入中…
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4" />
                  登入
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
        </div>
      </OverlayScrollbar>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex w-full items-center justify-center text-slate-500">
          <KeyRound className="h-6 w-6 animate-spin" />
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
