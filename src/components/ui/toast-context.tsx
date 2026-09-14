"use client";

import * as React from "react";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";

type ToastVariant = "default" | "destructive";

type Toast = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastContextValue = {
  /** 當前正在顯示的 toast (同一畫面最多只會有一個) */
  current: Toast | null;
  toast: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/** 兩個 toast 之間的停頓時間 (毫秒) — 避免畫面被洗版 */
const PAUSE_BETWEEN_TOASTS_MS = 600;
/** 隊列上限 — 超過時丟棄最舊的，避免記憶體膨脹 */
const MAX_QUEUE_LENGTH = 3;

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ToastContextProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<Toast | null>(null);
  const currentRef = useRef<Toast | null>(null);
  const queueRef = useRef<Toast[]>([]);

  // 用 ref 持有最新 callback，避免 setState → re-render → callback 重建造成的循環依賴
  const dismissRef = useRef<(id: string) => void>(() => {});
  const showNextRef = useRef<() => void>(() => {});
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 同步 ref 與 state，讓 toast() 能讀到最新 current 但又不需把 current 放進 deps
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  const clearTimers = useCallback(() => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  }, []);

  // 從隊列取出下一個顯示；若隊列空則把 current 清掉
  const showNextFromQueue = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) {
      setCurrent(null);
      return;
    }
    setCurrent(next);

    // 排程自動消失
    const duration = next.duration ?? 4000;
    if (duration > 0) {
      autoDismissTimerRef.current = setTimeout(() => {
        dismissRef.current(next.id);
      }, duration);
    }
  }, []);

  // 讓 timer 永遠呼叫到最新版本的 showNextFromQueue
  showNextRef.current = showNextFromQueue;

  const dismiss = useCallback((id: string) => {
    setCurrent((c) => {
      // 只處理「當前正在顯示」的 toast；隊列裡的由 showNextFromQueue 控制
      if (c?.id !== id) return c;

      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }
      // 停頓一段時間後再顯示下一個，避免視覺上連續彈出
      pauseTimerRef.current = setTimeout(() => {
        showNextRef.current();
      }, PAUSE_BETWEEN_TOASTS_MS);

      return null;
    });
  }, []);

  dismissRef.current = dismiss;

  const toast = useCallback((newToast: Omit<Toast, "id">) => {
    const toastObj: Toast = { id: generateId(), ...newToast };

    if (currentRef.current) {
      // 已有 toast → 加入隊列
      // 合併策略：相同 title+variant 視為同一訊息，只更新 description，避免重複堆積
      const existingIdx = queueRef.current.findIndex(
        (t) => t.title === toastObj.title && t.variant === toastObj.variant
      );
      if (existingIdx >= 0) {
        queueRef.current[existingIdx] = {
          ...queueRef.current[existingIdx],
          description: toastObj.description,
        };
      } else {
        queueRef.current.push(toastObj);
        // 超過隊列上限時丟棄最舊的，保留最新
        if (queueRef.current.length > MAX_QUEUE_LENGTH) {
          queueRef.current.shift();
        }
      }
    } else {
      // 沒有當前 toast → 立即顯示
      // 若剛好在停頓期間，按下立即顯示並取消停頓 timer
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
      setCurrent(toastObj);

      const duration = toastObj.duration ?? 4000;
      if (duration > 0) {
        if (autoDismissTimerRef.current) {
          clearTimeout(autoDismissTimerRef.current);
        }
        autoDismissTimerRef.current = setTimeout(() => {
          dismissRef.current(toastObj.id);
        }, duration);
      }
    }
  }, []); // 空 deps：callback identity 完全穩定

  // 卸載時清理所有 timer
  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  return (
    <ToastContext.Provider value={{ current, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastContextProvider");
  return ctx;
}
