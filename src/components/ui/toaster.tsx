"use client";

import { useEffect, useRef, useState } from "react";
import { ToastProvider as RadixToastProvider, ToastViewport } from "@/components/ui/toast";
import { ToastContextProvider, useToast } from "@/components/ui/toast-context";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

type ToastVariant = "default" | "destructive";

/** 實際渲染用的 toast (加上 exiting 標記) */
type RenderedToast = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  exiting: boolean;
};

/** Fade-out 動畫長度 (毫秒) — 必須與 className 上的 duration 一致 */
const EXIT_ANIMATION_MS = 300;

function ToastViewportList() {
  const { current, dismiss } = useToast();
  const [rendered, setRendered] = useState<RenderedToast | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 同步 rendered 與 current：
   *  - current 有 toast → 立即渲染 (data-state="open" → 觸發 fade-in)
   *  - current 清空  → 標記 exiting (data-state="closed" → 觸發 fade-out)，
   *                     等動畫跑完才從 DOM 移除
   */
  useEffect(() => {
    if (current) {
      // 新 toast 進來：取消任何 pending 的 exit timer
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      setRendered({
        id: current.id,
        title: current.title,
        description: current.description,
        variant: current.variant,
        exiting: false,
      });
    } else if (rendered && !rendered.exiting) {
      // Toast 被 dismiss：標記 exiting，動畫跑完後才清掉 DOM
      setRendered({ ...rendered, exiting: true });
      exitTimerRef.current = setTimeout(() => {
        setRendered(null);
        exitTimerRef.current = null;
      }, EXIT_ANIMATION_MS);
    }
    // rendered 在 deps 中是必要的 (讀取最新 exiting 狀態)。
    // 但下一輪 effect 若 rendered.exiting 已是 true，就不會進入第二個分支，
    // 因此不會造成無限循環。
  }, [current, rendered]);

  // 卸載時清理 timer
  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-3 sm:bottom-24 sm:px-4"
    >
      {rendered ? (
        <div
          key={rendered.id}
          data-state={rendered.exiting ? "closed" : "open"}
          className={cn(
            "pointer-events-auto relative flex w-full max-w-md items-center justify-between space-x-4 overflow-hidden rounded-lg border p-4 pr-8 shadow-lg",
            "duration-300",
            // Fade in / slide up (進場)
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-full",
            // Fade out / slide down (退場)
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-full",
            rendered.variant === "destructive"
              ? "border-red-500 bg-red-600 text-white"
              : "border-slate-200 bg-white text-slate-900"
          )}
        >
          <div className="grid gap-1">
            {rendered.title ? (
              <div className="text-sm font-semibold">{rendered.title}</div>
            ) : null}
            {rendered.description ? (
              <div className="text-sm opacity-90">{rendered.description}</div>
            ) : null}
          </div>
          <button
            onClick={() => dismiss(rendered.id)}
            className="absolute right-2 top-2 rounded-md p-1 opacity-70 hover:opacity-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Toaster({ children }: { children: React.ReactNode }) {
  return (
    <ToastContextProvider>
      <RadixToastProvider swipeDirection="right">
        {children}
        <ToastViewportList />
      </RadixToastProvider>
    </ToastContextProvider>
  );
}
