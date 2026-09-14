"use client";

import { useEffect } from "react";
import { getSitePublicEnabled } from "@/lib/site-settings";

const SITE_PUBLIC_OFF_COOKIE = "bus_site_public_off";

/**
 * 站台存取權限 Provider
 * 
 * 此元件在客戶端掛載時執行，負責：
 * 1. 檢查站台公開狀態
 * 2. 站台公開狀態 OFF 時，設定 cookie 讓 middleware 知道可以放行
 * 
 * 這樣 middleware 就能根據 cookie 判斷是否需要跳過鎖定頁。
 */
export function SiteAccessProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const isPublicOn = getSitePublicEnabled();
    
    if (!isPublicOn) {
      // 站台公開狀態 OFF：設定 cookie 讓 middleware 知道要放行
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString(); // 24 小時
      document.cookie = `${SITE_PUBLIC_OFF_COOKIE}=1; expires=${expires}; path=/; SameSite=Lax`;
    } else {
      // 站台公開狀態 ON：清除 cookie
      document.cookie = `${SITE_PUBLIC_OFF_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  }, []);

  return <>{children}</>;
}
