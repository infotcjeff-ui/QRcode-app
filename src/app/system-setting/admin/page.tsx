import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type {
  Bus,
  CheckLog,
  CheckLogWithStudent,
  Student,
  Trip,
  User,
  WhatsappStatus,
} from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Activity, AlertCircle, CheckCircle2, Clock, Users, Bus as BusIcon } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { BackButton } from "@/components/ui/back-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "管理員控制台 · 校巴系統" };

type AdminOverview = {
  buses: Bus[];
  students: Student[];
  users: User[];
  trips: Trip[];
  checkLogs: CheckLogWithStudent[];
  fetched: boolean;
  errorMessage?: string;
};

async function loadAdminData(): Promise<AdminOverview> {
  try {
    const [busesRes, studentsRes, usersRes, tripsRes, logsRes] = await Promise.all([
      supabase.from("buses").select("*"),
      supabase.from("students").select("*"),
      supabase.from("users").select("*"),
      supabase.from("trips").select("*").order("date", { ascending: false }),
      supabase.from("check_logs").select("*, student:students(*)").order("timestamp", { ascending: false }).limit(50),
    ]);

    const checkLogs: CheckLogWithStudent[] =
      (logsRes.data as CheckLogWithStudent[] | null)?.map((log) => ({
        ...(log as CheckLog),
        student: (log as CheckLogWithStudent).student ?? null,
      })) ?? [];

    return {
      buses: (busesRes.data as Bus[] | null) ?? [],
      students: (studentsRes.data as Student[] | null) ?? [],
      users: (usersRes.data as User[] | null) ?? [],
      trips: (tripsRes.data as Trip[] | null) ?? [],
      checkLogs,
      fetched: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error loading admin overview";
    return {
      buses: [],
      students: [],
      users: [],
      trips: [],
      checkLogs: [],
      fetched: false,
      errorMessage: message,
    };
  }
}

function WhatsappBadge({ status }: { status: WhatsappStatus }) {
  if (status === "sent") {
    return (
      <Badge variant="success" className="text-[10px]">
        <CheckCircle2 className="mr-1 h-3 w-3" /> WhatsApp 已發送
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="destructive" className="text-[10px]">
        <AlertCircle className="mr-1 h-3 w-3" /> 發送失敗
      </Badge>
    );
  }
  return (
    <Badge variant="warning" className="text-[10px]">
      <Clock className="mr-1 h-3 w-3" /> 排隊中
    </Badge>
  );
}

export default async function AdminDashboardPage() {
  const overview = await loadAdminData();

  const activeTrips = overview.trips.filter((t) => t.status === "active");
  const totalBoarding = overview.checkLogs.filter((l) => l.type === "ON").length;
  const totalAlighting = overview.checkLogs.filter((l) => l.type === "OFF").length;

  const studentById = new Map(overview.students.map((s) => [s.id, s]));
  const busById = new Map(overview.buses.map((b) => [b.id, b]));

  return (
    <main className="flex w-full flex-col gap-6 overflow-auto px-4 py-6 sm:px-6 lg:px-8 scrollbar-inset">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            <Activity className="h-6 w-6" />
            管理員控制台
          </h1>
          <p className="text-sm text-slate-500">陳大文主管 (Admin) · 即時全校監控</p>
        </div>
        <BackButton href="/system-setting" label="返回系統設定" />
      </header>

      {!overview.fetched ? (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <AlertCircle className="h-5 w-5" /> Supabase 連線尚未設定
            </CardTitle>
            <CardDescription className="text-amber-800">
              {overview.errorMessage ?? "請複製 .env.local.example 為 .env.local 並填入 Supabase 金鑰後重啟伺服器。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-amber-900">
            <p>目前顯示的為種子資料預覽，正式資料會在連線建立後自動同步。</p>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="在線班次" value={activeTrips.length} icon={<BusIcon className="h-5 w-5" />} />
        <StatCard label="已註冊學生" value={overview.students.length} icon={<Users className="h-5 w-5" />} />
        <StatCard label="今日上車打卡" value={totalBoarding} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="今日落車打卡" value={totalAlighting} icon={<CheckCircle2 className="h-5 w-5" />} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">車輛與路線</CardTitle>
            <CardDescription>所有註冊校巴基本資料</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.buses.length === 0 ? (
              <Empty text="尚無車輛資料" />
            ) : (
              overview.buses.map((bus) => (
                <div key={bus.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="font-semibold">{bus.route_name}</div>
                    <div className="text-xs text-slate-500">車牌：{bus.plate_number}</div>
                  </div>
                  <Badge variant="outline">容量 {bus.capacity} 人</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">人員帳號</CardTitle>
            <CardDescription>保姆與管理員清單</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.users.length === 0 ? (
              <Empty text="尚無帳號資料" />
            ) : (
              overview.users.map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-xs text-slate-500">{u.phone}</div>
                  </div>
                  <Badge variant={u.role === "admin" ? "default" : "warning"}>
                    {u.role === "admin" ? "管理員" : "保姆"}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">最近打卡紀錄</CardTitle>
          <CardDescription>由所有班次即時彙總</CardDescription>
        </CardHeader>
        <CardContent>
          {overview.checkLogs.length === 0 ? (
            <Empty text="尚無打卡紀錄" />
          ) : (
            <ul className="divide-y">
              {overview.checkLogs.map((log) => {
                const student = log.student ?? studentById.get(log.student_id) ?? null;
                const bus = student?.assigned_bus_id ? busById.get(student.assigned_bus_id) : undefined;
                return (
                  <li key={log.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{student?.name ?? "未知學生"}</span>
                        <Badge variant={log.type === "ON" ? "success" : "secondary"} className="text-[10px]">
                          {log.type === "ON" ? "上車" : "落車"}
                        </Badge>
                      </div>
                      <span className="text-xs text-slate-500">
                        {bus?.route_name ?? "未指派路線"} · {log.location_name ?? "未提供地點"}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-medium">{formatTime(log.timestamp)}</span>
                      <WhatsappBadge status={log.whatsapp_status} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Separator />

      <footer className="text-center text-xs text-slate-400">
        © School Bus Check-in System · Realtime Supabase Subscriptions enabled
      </footer>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div className="rounded-lg bg-slate-100 p-2 text-slate-700">{icon}</div>
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed bg-slate-50 p-4 text-center text-sm text-slate-400">{text}</div>;
}
