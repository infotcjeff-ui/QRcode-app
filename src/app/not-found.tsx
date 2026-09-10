import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex w-full items-center justify-start">
        <BackButton fallback="/" />
      </div>
      <h1 className="text-4xl font-bold text-slate-900">404</h1>
      <p className="text-slate-600">找不到此頁面</p>
      <Button asChild>
        <Link href="/">返回首頁</Link>
      </Button>
    </main>
  );
}
