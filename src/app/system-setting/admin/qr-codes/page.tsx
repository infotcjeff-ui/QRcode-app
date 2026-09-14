import Link from "next/link";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase-server";
import type { Bus, Student } from "@/lib/types";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { QrCodeGrid } from "@/components/admin/qr-code-grid";

export const dynamic = "force-dynamic";

async function load(): Promise<{ students: Student[]; busPlateById: Record<string, string> }> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return { students: [], busPlateById: {} };
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
    <main className="flex w-full flex-col bg-slate-50">
      <PageHeader title="學生 QR Code 列印" href="/system-setting" />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-28 pt-5 sm:px-6 lg:px-8">
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
      </div>
    </main>
  );
}
