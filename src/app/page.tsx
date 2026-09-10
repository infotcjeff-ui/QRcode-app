"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bus, Loader2 } from "lucide-react";
import { clearSiteAccessCookie, getAuthUser, ROLE_LABEL } from "@/lib/auth";

/**
 * 根路徑自動分流：
 *  - 沒有登入 → 回到 /lock 重新輸入網站密碼
 *  - 已登入管理員 → /system-setting
 *  - 已登入保姆 → /scan（QR Code 打卡主頁）
 */
export default function RootRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // 主動清掉 cookie，避免使用者關掉瀏覽器後仍殘留太久。
    clearSiteAccessCookie();
    const user = getAuthUser();
    if (!user) {
      router.replace("/lock");
      return;
    }
    if (user.role === "admin") {
      router.replace("/system-setting");
    } else if (user.role === "nanny") {
      router.replace("/scan");
    } else {
      router.replace("/lock");
    }
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 text-slate-500">
      <Bus className="mb-3 h-10 w-10 text-slate-700" />
      <Loader2 className="h-5 w-5 animate-spin" />
      <p className="mt-3 text-xs">載入中…</p>
      <p className="mt-1 text-[10px] text-slate-400">
        {ROLE_LABEL.admin} / {ROLE_LABEL.nanny}
      </p>
    </main>
  );
}
