import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase-server";
import type { Bus, Student } from "@/lib/types";
import { StudentsPageClient } from "@/components/admin/students-page-client";

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
  return <StudentsPageClient initialStudents={students} buses={buses} />;
}
