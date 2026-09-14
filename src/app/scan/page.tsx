"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * 舊版打卡頁 — 已重新組織為 `/scan-in` 並提供三個 Tab：
 *   1. 點名
 *   2. QR Code
 *   3. 人臉
 *
 * 為保持向後相容，`/scan` 自動導向新的 `/scan-in`。
 */
export default function LegacyScanRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/scan-in");
  }, [router]);

  return (
    <main className="flex h-svh w-full flex-col items-center justify-center gap-3 bg-slate-50 text-slate-500">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      <p className="text-sm">正在前往新打卡頁 /scan-in…</p>
      <p className="text-xs text-slate-400">
        此頁已重新組織為「點名 / QR Code / 人臉」三個 Tab。
      </p>
    </main>
  );
}
