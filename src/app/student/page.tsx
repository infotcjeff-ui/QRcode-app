import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Bus, CheckLog, Student } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { OverlayScrollbar } from "@/components/ui/overlay-scrollbar";
import { ParentSearchClient } from "./parent-search-client";

export const dynamic = "force-dynamic";

type InitialStudent = Student & {
  bus: Bus | null;
  latestLog: (CheckLog & { type: string }) | null;
};

async function loadStudents(): Promise<InitialStudent[]> {
  try {
    const [studentsRes, busesRes, logsRes] = await Promise.all([
      supabase.from("students").select("*").order("student_no"),
      supabase.from("buses").select("*"),
      supabase
        .from("check_logs")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(50),
    ]);

    const buses = (busesRes.data as Bus[] | null) ?? [];
    const busById = new Map(buses.map((b) => [b.id, b]));
    const students = (studentsRes.data as Student[] | null) ?? [];

    const logs = (logsRes.data as CheckLog[] | null) ?? [];
    const latestByStudent = new Map<string, CheckLog>();
    for (const log of logs) {
      if (!latestByStudent.has(log.student_id)) {
        latestByStudent.set(log.student_id, log);
      }
    }

    return students.map((s) => {
      const bus = s.assigned_bus_id ? busById.get(s.assigned_bus_id) ?? null : null;
      const latestLog = latestByStudent.get(s.id) ?? null;
      return { ...s, bus, latestLog };
    });
  } catch {
    return [];
  }
}

export default async function ParentSearchPage() {
  const students = await loadStudents();

  return (
    <main className="relative flex h-svh w-full flex-col bg-slate-50">
      <OverlayScrollbar className="flex-1">
        <div className="flex flex-col gap-4 px-4 py-6 pb-24">
          <header className="flex items-center justify-between">
            <BackButton fallback="/" label="回首頁" />
            <h1 className="text-sm font-medium text-slate-500">家長即時追蹤 · 搜尋</h1>
          </header>

          <Card className="border-emerald-200 bg-emerald-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-emerald-900">輸入子女學號開始追蹤</CardTitle>
              <CardDescription className="text-emerald-700">
                請輸入 STU No（例如 <code className="rounded bg-white/60 px-1">STU2026001</code>）以顯示對應學生的即時狀態。
              </CardDescription>
            </CardHeader>
          </Card>

          <ParentSearchClient initialStudents={students} />

          <footer className="mt-auto text-center text-[10px] text-slate-400">
            © School Bus Check-in · Realtime · Powered by Supabase
          </footer>
        </div>
      </OverlayScrollbar>
    </main>
  );
}
