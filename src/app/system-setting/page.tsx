import Link from "next/link";
import { ArrowLeft, ArrowRight, BarChart3, Bus, GraduationCap, QrCode, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/ui/back-button";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "系統設定 · 校巴安全打卡系統",
};

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
    href: "/system-setting/admin/buses",
    title: "校巴資料管理",
    description: "新增 / 修改 / 刪除校巴車牌、路線與載客量，並同步寫入 Supabase。",
    icon: <Bus className="h-8 w-8" />,
    badge: "Buses",
    tone: "warning",
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
    href: "/system-setting/admin/statistics",
    title: "統計表",
    description: "依打卡資料即時彙整班次統計、上落車率、路線比較等進階報表。",
    icon: <BarChart3 className="h-8 w-8" />,
    badge: "Reports",
    tone: "success",
  },
  {
    href: "/scan",
    title: "打卡系統",
    description: "Mobile-first 介面，使用後置鏡頭掃描學生 QR Code，即時上傳打卡紀錄。",
    icon: <Bus className="h-8 w-8" />,
    badge: "Scan",
    tone: "warning",
  },
  {
    href: "/student",
    title: "家長即時追蹤",
    description: "輸入子女 STU No 搜尋後，查看最新上下車狀態與即時通知。",
    icon: <Users className="h-8 w-8" />,
    badge: "Parent",
    tone: "success",
  },
];

export default function SystemSettingPage() {
  return (
    <main className="flex w-full max-w-full flex-col gap-8 overflow-auto px-4 py-10 sm:px-6 lg:px-8 scrollbar-inset">
      <header className="flex items-center justify-center gap-2 sm:justify-between">
        <BackButton parent="/profile" fallback="/profile" className="hidden sm:inline-flex" />
        <div className="flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Bus className="h-5 w-5" />
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            系統設定
          </h1>
        </div>
        <div className="hidden sm:block sm:w-[88px]" aria-hidden />
      </header>

      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-700 sm:text-lg">功能入口</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                    進入
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="mt-auto rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500">
        <p>
          <Link href="/profile" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
            <ArrowLeft className="h-3 w-3" /> 前往個人資料頁
          </Link>
        </p>
      </footer>
    </main>
  );
}
