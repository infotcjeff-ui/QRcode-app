import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Bus, Student } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode as QrIcon } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { QrCodeGrid } from "@/components/admin/qr-code-grid";

export const dynamic = "force-dynamic";

async function load(): Promise<{ students: Student[]; busPlateById: Record<string, string> }> {
  try {
    const [studentsRes, busesRes] = await Promise.all([
      supabase.from("students").select("*").order("student_no"),
      supabase.from("buses").select("*"),
    ]);
    const busPlateById: Record<string, string> = {};
    ((busesRes.data as Bus[] | null) ?? []).forEach((b) => {
      busPlateById[b.id] = `${b.plate_number} · ${b.route_name}`;
    });
    return {
      students: (studentsRes.data as Student[] | null) ?? [],
      busPlateById,
    };
  } catch {
    return { students: [], busPlateById: {} };
  }
}

export default async function QrCodesPage() {
  const { students, busPlateById } = await load();

  return (
    <main className="flex w-full flex-col gap-6 overflow-auto px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            <QrIcon className="h-6 w-6" /> 學生 QR Code 列印
          </h1>
          <p className="text-sm text-slate-500">批次產生所有學生 QR Code，支援列印或下載 PNG</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BackButton href="/system-setting/admin/students" label="學生管理" variant="outline" />
          <BackButton href="/system-setting" label="系統設定" variant="outline" />
        </div>
      </header>

      {students.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>尚無學生資料</CardTitle>
            <CardDescription>
              請先到 <Link href="/system-setting/admin/students" className="text-blue-600 underline">學生管理</Link> 新增學生。
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <QrCodeGrid students={students} busPlateById={busPlateById} />
      )}
    </main>
  );
}
