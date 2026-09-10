import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { CheckLog, CheckLogType, Student, Trip } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, MapPin, User } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { BackButton } from "@/components/ui/back-button";
import { ParentRealtimeTracker } from "./parent-realtime-tracker";

export const dynamic = "force-dynamic";

type Props = {
  params: { id: string };
};

type InitialData = {
  student: Student | null;
  activeTrip: Trip | null;
  logs: (CheckLog & { type: CheckLogType })[];
  errorMessage?: string;
};

async function loadInitial(studentId: string): Promise<InitialData> {
  if (!studentId) {
    return { student: null, activeTrip: null, logs: [], errorMessage: "Missing student ID" };
  }

  try {
    const [studentRes, tripRes, logsRes] = await Promise.all([
      supabase.from("students").select("*").eq("id", studentId).maybeSingle(),
      supabase
        .from("trips")
        .select("*")
        .eq("status", "active")
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("check_logs")
        .select("*")
        .eq("student_id", studentId)
        .order("timestamp", { ascending: false })
        .limit(20),
    ]);

    const student = (studentRes.data as Student | null) ?? null;
    const activeTrip = (tripRes.data as Trip | null) ?? null;
    const logs = ((logsRes.data as CheckLog[] | null) ?? []) as (CheckLog & { type: CheckLogType })[];

    return { student, activeTrip, logs };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { student: null, activeTrip: null, logs: [], errorMessage: message };
  }
}

export default async function StudentParentPage({ params }: Props) {
  const studentId = params.id;
  const initial = await loadInitial(studentId);

  if (!initial.student && !initial.errorMessage) {
    notFound();
  }

  const student = initial.student;
  const initialCheckLog = initial.logs[0] ?? null;

  return (
    <main className="flex w-full flex-col gap-4 overflow-auto bg-slate-50 px-4 py-6 scrollbar-inset">
      <header className="flex items-center justify-between">
        <BackButton fallback="/student" label="返回搜尋" />
        <h1 className="text-sm font-medium text-slate-500">家長即時追蹤</h1>
      </header>

      <Card className="border-emerald-200 bg-emerald-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-900">
            <User className="h-5 w-5" />
            {student?.name ?? "未找到學生資料"}
          </CardTitle>
          <CardDescription className="text-emerald-700">
            學號 {student?.student_no} · 家長 {student?.parent_name ?? "-"} · 電話 {student?.parent_phone ?? "-"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {initial.errorMessage ? (
            <p className="text-xs text-amber-700">⚠ Supabase 連線錯誤：{initial.errorMessage}</p>
          ) : !student ? (
            <p className="text-xs text-amber-700">⚠ 找不到對應學生資料，請確認 ID 正確。</p>
          ) : (
            <ParentRealtimeTracker
              studentId={student.id}
              initialTripId={initial.activeTrip?.id ?? null}
              initialLog={
                initialCheckLog
                  ? {
                      id: initialCheckLog.id,
                      type: initialCheckLog.type,
                      timestamp: initialCheckLog.timestamp,
                      location_name: initialCheckLog.location_name,
                      whatsapp_status: initialCheckLog.whatsapp_status,
                    }
                  : null
              }
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">歷史打卡紀錄</CardTitle>
          <CardDescription>最近 20 筆</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {initial.logs.length === 0 ? (
            <p className="text-center text-sm text-slate-400">暫無打卡紀錄</p>
          ) : (
            initial.logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-md border bg-white p-3 text-sm"
              >
                <div className="flex flex-col">
                  <Badge variant={log.type === "ON" ? "success" : "secondary"} className="w-fit">
                    {log.type === "ON" ? "上車" : "落車"}
                  </Badge>
                  <span className="mt-1 text-xs text-slate-500">{log.location_name ?? "未提供地點"}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-medium">{formatTime(log.timestamp)}</span>
                  <span className="text-[10px] text-slate-400">
                    {log.whatsapp_status === "sent" ? "已通知家長" : log.whatsapp_status === "failed" ? "通知失敗" : "排隊中"}
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <footer className="mt-auto text-center text-[10px] text-slate-400">
        © School Bus Check-in · Realtime · Powered by Supabase
      </footer>
    </main>
  );
}