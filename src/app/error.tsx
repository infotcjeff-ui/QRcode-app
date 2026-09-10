"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service in production.
    console.error("[Error]", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex w-full items-center justify-start">
        <BackButton fallback="/" />
      </div>
      <h1 className="text-4xl font-bold text-slate-900">錯誤</h1>
      <p className="text-slate-600">
        發生了一些問題。請稍後再試，或返回首頁。
      </p>
      {error.digest ? (
        <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-500">
          Error ID: {error.digest}
        </code>
      ) : null}
      <div className="flex gap-2">
        <Button onClick={() => reset()} variant="outline">
          重試
        </Button>
        <Button asChild>
          <Link href="/">返回首頁</Link>
        </Button>
      </div>
    </main>
  );
}
