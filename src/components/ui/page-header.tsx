"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  /** 標題文字 */
  title: React.ReactNode;
  /** 直接導向的目標路徑，若提供會優先使用 router.push(href) */
  href?: string;
  /** 返回按鈕點擊事件，若未提供則預設呼叫 history.back() */
  onBack?: () => void;
  /** 返回按鈕顯示文字 (預設 "返回") */
  backLabel?: string;
  /** 額外 className */
  className?: string;
  /** 是否只要 icon (不含文字) */
  iconOnly?: boolean;
};

/**
 * 統一的頁面頂部列：
 *  - 左側：返回按鈕 (icon + 文字)
 *  - 中間：居中標題
 *  - 右側：留白 (與返回按鈕等寬，避免標題視覺偏移)
 *
 * 用法：
 *   <PageHeader title="個人資料" onBack={() => router.push("/")} />
 *   <PageHeader title="校巴管理" href="/system-setting" />
 */
export function PageHeader({
  title,
  href,
  onBack,
  backLabel = "返回",
  className,
  iconOnly = false,
}: Props) {
  const router = useRouter();

  const handleClick = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (href) {
      router.push(href);
      return;
    }
    if (typeof window !== "undefined") {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "/";
      }
    }
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex w-full items-center justify-between",
        "border-b border-slate-200/60 bg-white/80 px-5 py-3 backdrop-blur-xl backdrop-saturate-150",
        className
      )}
    >
      <button
        type="button"
        onClick={handleClick}
        aria-label={backLabel}
        className={cn(
          "flex items-center gap-1 rounded-full px-2 py-1.5 text-[14px] font-medium text-slate-700 transition-colors",
          "hover:bg-slate-100 active:bg-slate-200"
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        {!iconOnly ? <span>{backLabel}</span> : null}
      </button>

      <h1 className="absolute left-1/2 -translate-x-1/2 text-[16px] font-semibold tracking-tight text-slate-900">
        {title}
      </h1>

      <div className="min-w-[44px]" aria-hidden />
    </header>
  );
}
