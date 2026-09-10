import Link from "next/link";
import { ArrowLeft, ArrowRight, Bus, GraduationCap, QrCode, ShieldCheck, Smartphone, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "系統設定 · 校巴安全打卡系統",
};

const TEST_STUDENT_ID = "88888888-8888-8888-8888-888888888888";

type RoleLink = {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  badge: string;
  tone: "default" | "success" | "warning";
};

const ROLES: RoleLink[] = [
  {
    href: "/system-setting/admin",
    title: "管理員控制台",
    description: "查看全校路線、班次實時狀態、學生出勤紀錄與 WhatsApp 通知進度。",
    icon: <ShieldCheck className="h-8 w-8" />,
    badge: "Admin",
    tone: "default",
  },
  {
    href: "/system-setting/admin/students",
    title: "學生管理",
    description: "新增 / 刪除學生資料，產生 QR Code，取得家長追蹤連結。",
    icon: <GraduationCap className="h-8 w-8" />,
    badge: "CRUD",
    tone: "default",
  },
  {
    href: "/system-setting/admin/qr-codes",
    title: "QR Code 批次產生",
    description: "批次產生全部學生 QR Code，支援列印或下載 PNG 圖檔。",
    icon: <QrCode className="h-8 w-8" />,
    badge: "Print",
    tone: "warning",
  },
  {
    href: "/scan",
    title: "保姆流動打卡",
    description: "Mobile-first 介面，使用後置鏡頭掃描學生 QR Code，即時上傳打卡紀錄。",
    icon: <Bus className="h-8 w-8" />,
    badge: "Nanny",
    tone: "warning",
  },
  {
    href: `/student/${TEST_STUDENT_ID}`,
    title: "家長即時追蹤",
    description: "查看子女最新上下車狀態與即將到達時間通知。",
    icon: <Users className="h-8 w-8" />,
    badge: "Parent",
    tone: "success",
  },
];

export default function SystemSettingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 text-center sm:text-left">
        <div className="flex items-center justify-center gap-2 sm:justify-start">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Bus className="h-5 w-5" />
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            系統設定 · System Setting
          </h1>
        </div>
        <p className="text-base text-slate-600 sm:text-lg">
          School Bus Check-in &amp; Parent Tracking · Mobile-first · Realtime
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="default">Next.js 14</Badge>
          <Badge variant="secondary">TypeScript</Badge>
          <Badge variant="secondary">Tailwind CSS</Badge>
          <Badge variant="secondary">shadcn/ui</Badge>
          <Badge variant="success">Supabase</Badge>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ROLES.map((role) => (
          <Card
            key={role.href}
            className="group flex flex-col justify-between transition-all hover:-translate-y-1 hover:shadow-md"
          >
            <CardHeader>
              <div className="mb-2 flex items-center justify-between">
                <div className="rounded-lg bg-slate-100 p-2 text-slate-700 group-hover:bg-slate-900 group-hover:text-white">
                  {role.icon}
                </div>
                <Badge variant={role.tone}>{role.badge}</Badge>
              </div>
              <CardTitle className="text-xl">{role.title}</CardTitle>
              <CardDescription className="min-h-[3rem] text-sm">
                {role.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href={role.href}>
                  進入測試
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
          <Smartphone className="h-5 w-5" /> 手機測試快速指南
        </div>
        <ol className="space-y-2 text-sm text-slate-700">
          <li>
            <span className="font-medium">1. 確認同一個 Wi-Fi：</span>
            電腦和手機都連到同一個 Wi-Fi 網絡 (本機 IP <code className="rounded bg-slate-100 px-1">192.168.1.55</code>)。
          </li>
          <li>
            <span className="font-medium">2. 重啟 dev server (已改用 0.0.0.0)：</span>
            <code className="ml-1 rounded bg-slate-100 px-1">npm run dev:lan</code> 或 <code className="rounded bg-slate-100 px-1">npm run dev</code>
          </li>
          <li>
            <span className="font-medium">3. 在手機瀏覽器輸入：</span>
            <code className="ml-1 rounded bg-slate-100 px-1">http://192.168.1.55:3000</code>
          </li>
          <li>
            <span className="font-medium">4. 鏡頭不能用？</span>手機瀏覽器要求 HTTPS 才能開相機；改用 Cloudflare tunnel：
            <code className="ml-1 rounded bg-slate-100 px-1">npm run dev:tunnel</code>
          </li>
        </ol>
      </section>

      <footer className="mt-auto rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500">
        <p>
          <Link href="/scan" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
            <ArrowLeft className="h-3 w-3" /> 回到 QR Code 打卡主頁
          </Link>
        </p>
      </footer>
    </main>
  );
}
