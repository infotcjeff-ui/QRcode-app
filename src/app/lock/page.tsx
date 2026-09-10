"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bus, Eye, EyeOff, KeyRound, Loader2, Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  setSiteAccessCookie,
  verifySitePassword,
} from "@/lib/auth";

function LockPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/login";

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setError(null);
  }, [password]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    // 模擬短暫延遲，避免暴力破解時的快速反應。
    await new Promise((resolve) => setTimeout(resolve, 350));

    if (!verifySitePassword(password)) {
      setError("密碼不正確，請再試一次。");
      setSubmitting(false);
      return;
    }

    setSiteAccessCookie("granted");
    router.replace(nextPath);
  }

  return (
    <main className="flex h-full w-full flex-col items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-slate-100">
      {/* 背景裝飾 */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute bottom-[-160px] right-[-120px] h-[360px] w-[360px] rounded-full bg-sky-500/15 blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
            <Bus className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            校巴安全打卡系統
          </h1>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-100">
            <Lock className="h-4 w-4 text-emerald-400" />
            請輸入網站密碼以繼續
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                網站密碼
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="請輸入密碼"
                  autoFocus
                  autoComplete="current-password"
                  className="border-white/10 bg-slate-900/60 pr-10 text-slate-100 placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:text-slate-100"
                  aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error ? (
              <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={submitting || !password}
              className="w-full bg-emerald-600 hover:bg-emerald-500"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  驗證中…
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4" />
                  進入系統
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-500">
          此頁面僅供授權人員使用。所有連線會被記錄。
        </p>
      </div>
    </main>
  );
}

export default function LockPage() {
  return (
    <Suspense
      fallback={
        <main className="flex h-full w-full items-center justify-center bg-slate-950 text-slate-100">
          <Loader2 className="h-6 w-6 animate-spin" />
        </main>
      }
    >
      <LockPageContent />
    </Suspense>
  );
}
