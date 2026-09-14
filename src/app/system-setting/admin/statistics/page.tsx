import { supabase } from "@/lib/supabase";
import type { Bus, StatisticsReport, Trip, User } from "@/lib/types";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatisticsClient } from "@/components/admin/statistics-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "統計表 · 管理員控制台" };

type PageData = {
  reports: StatisticsReport[];
  buses: Bus[];
  trips: Trip[];
  users: User[];
  supabaseConfigured: boolean;
};

async function load(): Promise<PageData> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const configured = Boolean(supabaseUrl && anonKey);

  if (!configured) {
    return { reports: [], buses: [], trips: [], users: [], supabaseConfigured: false };
  }

  try {
    const [reportsRes, busesRes, tripsRes, usersRes] = await Promise.all([
      supabase
        .from("statistics_reports")
        .select("*")
        .order("generated_at", { ascending: false })
        .limit(50),
      supabase.from("buses").select("*").order("route_name"),
      supabase
        .from("trips")
        .select("*")
        .order("date", { ascending: false })
        .limit(200),
      supabase.from("users").select("*").order("name"),
    ]);

    return {
      reports: (reportsRes.data as StatisticsReport[] | null) ?? [],
      buses: (busesRes.data as Bus[] | null) ?? [],
      trips: (tripsRes.data as Trip[] | null) ?? [],
      users: (usersRes.data as User[] | null) ?? [],
      supabaseConfigured: true,
    };
  } catch {
    return { reports: [], buses: [], trips: [], users: [], supabaseConfigured: false };
  }
}

export default async function AdminStatisticsPage() {
  const data = await load();

  return (
    <main className="flex w-full flex-col bg-slate-50">
      <PageHeader title="統計表" href="/system-setting" />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pb-28 pt-5 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-500">
          依打卡資料（check_logs）即時彙整進階報表，並寫入 Supabase statistics_reports 表供後續瀏覽。
        </p>
        {!data.supabaseConfigured ? (
          <Card className="border-amber-300 bg-amber-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-900">
                <Database className="h-5 w-5" /> Supabase 尚未連線
              </CardTitle>
              <CardDescription className="text-amber-800">
                請設定 .env.local 後重啟伺服器。所有報表皆會寫入 Supabase statistics_reports 表。
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <StatisticsClient
            initialReports={data.reports}
            buses={data.buses}
            trips={data.trips}
            users={data.users}
          />
        )}
      </div>
    </main>
  );
}
