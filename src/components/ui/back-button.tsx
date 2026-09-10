"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  /** 若沒有歷史紀錄（第一次進入）時要前往的路徑。預設 `/`。 */
  fallback?: string;
  /** 按鈕顯示文字。 */
  label?: string;
  /** 是否只顯示 icon（不含文字）。 */
  iconOnly?: boolean;
  /** 額外 className，方便自訂位置/樣式。 */
  className?: string;
  /** 若提供，會覆寫預設行為，直接 push 這個路徑。 */
  href?: string;
  /** 變體。 */
  variant?: "ghost" | "outline" | "default";
  /** 大小。 */
  size?: "default" | "sm" | "lg" | "icon";
};

/**
 * 返回按鈕：優先呼叫 router.back()，沒有歷史時導向 fallback 或指定 href。
 *
 * 用法：
 *   <BackButton />                              // 純返回上一頁
 *   <BackButton fallback="/system-setting" />   // 沒歷史時去系統設定
 *   <BackButton href="/student" />              // 直接跳到搜尋頁
 *   <BackButton iconOnly />                     // 手機版只顯示 icon
 */
export function BackButton({
  fallback = "/",
  label = "返回",
  iconOnly = false,
  className,
  href,
  variant = "ghost",
  size = "sm",
}: Props) {
  const router = useRouter();

  function handleClick() {
    if (href) {
      router.push(href);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.replace(fallback);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleClick}
      className={className}
      aria-label={label}
    >
      <ArrowLeft className={iconOnly ? "h-4 w-4" : "mr-1 h-4 w-4"} />
      {!iconOnly ? label : null}
    </Button>
  );
}
