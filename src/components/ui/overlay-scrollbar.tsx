"use client";

/**
 * OverlayScrollbar
 * ----------------
 * 統一全站的滾動條樣式與行為：
 *  - 不佔用版面空間 (overlay / inset)
 *  - 觸控滾動 / 拖曳滾動皆可用
 *  - 停止滾動或滑鼠移開約 2 秒後自動隱藏
 *  - 滾動條寬度極幼 (~6px)、圓角 thumb
 *
 * 使用方式：取代 `overflow-y-auto` 容器。直接把 children 放進來即可，
 * 不需要再手動加 `overflow-*` 或 `scrollbar-inset` class。
 */

import { ComponentProps, ReactNode } from "react";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import type { PartialOptions } from "overlayscrollbars";

import "overlayscrollbars/overlayscrollbars.css";

import { cn } from "@/lib/utils";

type OverlayScrollbarsProps = ComponentProps<typeof OverlayScrollbarsComponent>;

interface OverlayScrollbarProps extends Omit<OverlayScrollbarsProps, "options"> {
  children: ReactNode;
  className?: string;
}

const overlayScrollbarOptions: PartialOptions = {
  scrollbars: {
    autoHide: "leave",
    autoHideDelay: 2000,
    autoHideSuspend: true,
    dragScroll: true,
    clickScroll: false,
    pointers: ["mouse", "touch", "pen"],
  },
  overflow: {
    x: "hidden",
    y: "scroll",
  },
};

export function OverlayScrollbar({
  children,
  className,
  ...rest
}: OverlayScrollbarProps) {
  return (
    <OverlayScrollbarsComponent
      defer
      options={overlayScrollbarOptions}
      className={cn("os-host", className)}
      {...rest}
    >
      {children}
    </OverlayScrollbarsComponent>
  );
}