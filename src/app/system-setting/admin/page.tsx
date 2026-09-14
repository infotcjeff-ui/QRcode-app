import Link from "next/link";
import { ArrowRight, Bus, Globe, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";
export const metadata = { title: "管理員控制台 · 校巴系統" };

type ConsoleLink = {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
};

const SECTIONS: ConsoleLink[] = [
  {
    href: "/system-setting/admin/buses",
    title: "車輛與路線",
    description: "新增 / 修改 / 刪除校巴車牌、路線與載客量。",
    icon: <Bus className="h-8 w-8" />,
  },
  {
    href: "/system-setting/admin/users",
    title: "人員帳號",
    description: "管理員與打卡員帳號的新增、修改與刪除。",
    icon: <Users className="h-8 w-8" />,
  },
  {
    href: "/system-setting/admin/site-settings",
    title: "站台設定",
    description: "控制站台公開狀態與站台密碼。",
    icon: <Globe className="h-8 w-8" />,
  },
];

export default function AdminDashboardPage() {
  return (
    <main className="flex w-full flex-col bg-slate-50">
      <PageHeader title="管理員控制台" href="/system-setting" />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pb-28 pt-5 sm:px-6 lg:px-8">
        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-700 sm:text-lg">管理功能</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SECTIONS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 rounded-xl"
              >
                <Card className="h-full transition-all group-hover:-translate-y-1 group-hover:shadow-md group-focus-visible:-translate-y-1 group-focus-visible:shadow-md">
                  <CardHeader>
                    <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white">
                      {s.icon}
                    </div>
                    <CardTitle className="flex items-center justify-between text-xl">
                      {s.title}
                      <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-slate-700" />
                    </CardTitle>
                    <CardDescription className="min-h-[3rem] text-sm">
                      {s.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-slate-400">點擊進入此頁面進行管理</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <footer className="text-center text-xs text-slate-400">
          © School Bus Check-in System · Realtime Supabase Subscriptions enabled
        </footer>
      </div>
    </main>
  );
}
