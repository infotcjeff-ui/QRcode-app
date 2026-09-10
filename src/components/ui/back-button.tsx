"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  /** 父層路徑 (例如 `/system-setting/admin/qr-codes` 的父層是 `/system-setting/admin`)。
   *  若有提供，會優先使用，無視當前路徑。 */
  parent?: string;
  /** 沒歷史或無法推算父層時的最終保險路徑。預設 `/`。 */
  fallback?: string;
  /** 按鈕顯示文字。 */
  label?: string;
  /** 是否只顯示 icon（不含文字）。 */
  iconOnly?: boolean;
  /** 額外 className，方便自訂位置/樣式。 */
  className?: string;
  /** 若提供，會覆寫所有自動行為，直接 push 這個路徑。 */
  href?: string;
  /** 變體。 */
  variant?: "ghost" | "outline" | "default";
  /** 大小。 */
  size?: "default" | "sm" | "lg" | "icon";
};

/**
 * 「回到上一層」按鈕。
 *  - 預設從 usePathname 推算父層 (例如 `/a/b` → `/a`)。
 *  - 不會使用 router.back()，避免使用者從 `/student/XYZ` 返回搜尋時反而跑到外部網站。
 *  - 可由 `parent` prop 強制指定父層；或由 `href` 強制指定最終目的地。
 *
 * 用法：
 *   <BackButton />                                // 自動推算父層
 *   <BackButton parent="/system-setting" />       // 明確指定父層
 *   <BackButton href="/student" />                // 直接跳到搜尋頁
 *   <BackButton fallback="/login" />              // 推算失敗時回 /login
 */
export function BackButton({
  parent,
  fallback = "/",
  label = "返回",
  iconOnly = false,
  className,
  href,
  variant = "ghost",
  size = "sm",
}: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";

  function computeParent(): string {
    if (parent) return parent;
    // 去掉尾端斜線並取父層
    const trimmed = pathname.replace(/\/+$/, "") || "/";
    if (trimmed === "/") return fallback;
    const idx = trimmed.lastIndexOf("/");
    if (idx <= 0) return "/";
    return trimmed.slice(0, idx) || "/";
  }

  function handleClick() {
    const dest = href ?? computeParent();
    router.push(dest);
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
