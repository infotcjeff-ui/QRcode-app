"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, QrCode, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAuthUser } from "@/lib/auth";

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** 是否只在已登入時顯示 */
  authRequired?: boolean;
};

const ITEMS: Item[] = [
  { href: "/", label: "主頁", icon: Home },
  { href: "/scan", label: "打卡", icon: QrCode },
  { href: "/profile", label: "個人", icon: User, authRequired: true },
  { href: "/system-setting", label: "設定", icon: Settings, authRequired: true },
];

/**
 * 底部導覽列 — 採用 Liquid Glass (流體玻璃) 風格：
 *  - 半透明 backdrop-filter (backdrop-blur + saturate)
 *  - 細邊框 + 內陰影，讓玻璃感更明顯
 *  - 圓形 pill 浮動於螢幕底部，避開 iPhone Home Indicator
 *
 * 隱藏規則：
 *  - 鎖定頁 (/lock) 與登入頁 (/login) 不顯示
 *  - 個人資料頁 (/profile) 不顯示「個人」按鈕，但仍顯示其他
 */
export function BottomNav() {
  const pathname = usePathname() ?? "/";
  const [authed, setAuthed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setAuthed(!!getAuthUser());
    const onChange = () => setAuthed(!!getAuthUser());
    window.addEventListener("bus-auth-user-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("bus-auth-user-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  // 在 /lock 與 /login 完全隱藏 (這兩頁是 auth gate)
  if (pathname === "/lock" || pathname === "/login") return null;

  // SSR 期間不要渲染 (避免 hydration mismatch)
  if (!mounted) return null;

  const items = ITEMS.filter((it) => !it.authRequired || authed);

  return (
    <nav
      aria-label="底部導覽"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(env(safe-area-inset-bottom),0.75rem)]"
    >
      <div
        className={cn(
          "pointer-events-auto relative flex items-center gap-1 rounded-full p-1.5",
          // Liquid glass 風格
          "border border-white/40 bg-white/40 shadow-[0_8px_32px_rgba(15,23,42,0.18)]",
          "backdrop-blur-2xl backdrop-saturate-150",
          // 內層高光
          "before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-b before:from-white/40 before:to-transparent before:opacity-60",
          "after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
        )}
      >
        {items.map((it) => {
          const Icon = it.icon;
          const active =
            it.href === "/"
              ? pathname === "/"
              : pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "group relative flex min-w-[64px] flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-[10px] font-medium transition-all",
                active
                  ? "bg-gradient-to-b from-slate-900 to-slate-700 text-white shadow-lg"
                  : "text-slate-700 hover:bg-white/60 hover:text-slate-900"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-transform",
                  active ? "scale-110" : "group-hover:scale-105"
                )}
              />
              <span>{it.label}</span>
              {active ? (
                <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
