"use client";

import { ToastProvider as RadixToastProvider, ToastViewport } from "@/components/ui/toast";
import { ToastContextProvider, useToast } from "@/components/ui/toast-context";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

function ToastViewportList() {
  const { toasts, dismiss } = useToast();
  return (
    <>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-4 pr-8 shadow-lg transition-all",
            t.variant === "destructive"
              ? "border-red-500 bg-red-600 text-white"
              : "border-slate-200 bg-white text-slate-900"
          )}
        >
          <div className="grid gap-1">
            {t.title ? <div className="text-sm font-semibold">{t.title}</div> : null}
            {t.description ? <div className="text-sm opacity-90">{t.description}</div> : null}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="absolute right-2 top-2 rounded-md p-1 opacity-70 hover:opacity-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <ToastViewport />
    </>
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