import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase-server";
import type { Bus, Student } from "@/lib/types";
import { StudentsPageClient } from "@/components/admin/students-page-client";
import { PageHeader } from "@/components/ui/page-header";
import { FaceApiProvider } from "@/lib/face-api-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FALLBACK_STUDENTS: Student[] = [];
const FALLBACK_BUSES: Bus[] = [];

async function load() {
  const configured = isSupabaseAdminConfigured();

  if (!configured) {
    return { students: FALLBACK_STUDENTS, buses: FALLBACK_BUSES };
  }

  const supabase = getSupabaseAdmin()!;

  const [sRes, bRes] = await Promise.all([
    supabase.from("students").select("*", { count: "exact", head: false }).order("student_no"),
    supabase.from("buses").select("*", { count: "exact", head: false }).order("route_name"),
  ]);

  return {
    students: (sRes.data as Student[] | null) ?? FALLBACK_STUDENTS,
    buses: (bRes.data as Bus[] | null) ?? FALLBACK_BUSES,
  };
}

export default async function StudentsPage() {
  const { students, buses } = await load();
  return (
    <main className="flex w-full flex-col bg-slate-50">
      <PageHeader title="學生管理" href="/system-setting" />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-28 pt-5 sm:px-6 lg:px-8">
        <FaceApiProvider>
          <StudentsPageClient initialStudents={students} buses={buses} />
        </FaceApiProvider>
      </div>
    </main>
  );
}
