import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase-server";
import type { Bus, CheckLogWithStudent, Student, Trip, User } from "@/lib/types";
import { ScanDashboardClient } from "@/components/scan/scan-dashboard-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HARDCODED_ATTENDANT_ID = "22222222-2222-2222-2222-222222222222";
const HARDCODED_TRIP_ID = "77777777-7777-7777-7777-777777777777";
const HARDCODED_BUS_ID = "99999999-9999-9999-9999-999999999999";

type LoadResult = {
  attendant: User;
  trip: Trip;
  bus: Bus;
  students: Student[];
  logs: CheckLogWithStudent[];
  supabaseConfigured: boolean;
};

const FALLBACK_ATTENDANT: User = {
  id: HARDCODED_ATTENDANT_ID,
  name: "張翠蘭姐",
  phone: "+85290002222",
  role: "attendant",
  assigned_bus_id: HARDCODED_BUS_ID,
};

const FALLBACK_TRIP: Trip = {
  id: HARDCODED_TRIP_ID,
  bus_id: HARDCODED_BUS_ID,
  attendant_id: HARDCODED_ATTENDANT_ID,
  date: new Date().toISOString().slice(0, 10),
  type: "AM_GO",
  status: "active",
};

const FALLBACK_BUS: Bus = {
  id: HARDCODED_BUS_ID,
  plate_number: "AM1234",
  route_name: "沙田A線",
  capacity: 24,
};

const FALLBACK_STUDENTS: Student[] = [
  {
    id: "72796632-8672-5bf2-bfe7-73e9e562eb31", // STU2026001 藍小明
    name: "藍小明",
    student_no: "STU2026001",
    photo_url: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400",
    parent_name: "藍先生",
    parent_phone: "+85261234567",
    assigned_bus_id: HARDCODED_BUS_ID,
  },
];

async function load(): Promise<LoadResult> {
  const adminConfigured = isSupabaseAdminConfigured();

  if (!adminConfigured) {
    return {
      attendant: FALLBACK_ATTENDANT,
      trip: FALLBACK_TRIP,
      bus: FALLBACK_BUS,
      students: FALLBACK_STUDENTS,
      logs: [],
      supabaseConfigured: false,
    };
  }

  const supabase = getSupabaseAdmin()!;

  const [attendantRes, tripRes, busRes, studentsRes, logsRes] = await Promise.all([
    supabase.from("users").select("*").eq("id", HARDCODED_ATTENDANT_ID).maybeSingle(),
    supabase.from("trips").select("*").eq("id", HARDCODED_TRIP_ID).maybeSingle(),
    supabase.from("buses").select("*").eq("id", HARDCODED_BUS_ID).maybeSingle(),
    supabase.from("students").select("*", { count: "exact", head: false }),
    supabase
      .from("check_logs")
      .select("*, student:students(*)")
      .eq("trip_id", HARDCODED_TRIP_ID)
      .order("timestamp", { ascending: false })
      .limit(50),
  ]);

  const attendant = (attendantRes.data as User | null) ?? FALLBACK_ATTENDANT;
  const trip = (tripRes.data as Trip | null) ?? FALLBACK_TRIP;
  const bus = (busRes.data as Bus | null) ?? FALLBACK_BUS;
  const students = (studentsRes.data as Student[] | null) ?? FALLBACK_STUDENTS;
  const logs: CheckLogWithStudent[] =
    (logsRes.data as CheckLogWithStudent[] | null)?.map((log) => ({
      ...(log as CheckLogWithStudent),
      student: (log as CheckLogWithStudent).student ?? null,
    })) ?? [];

  return { attendant, trip, bus, students, logs, supabaseConfigured: true };
}

export default async function ScanPage() {
  const data = await load();
  return (
    <ScanDashboardClient
      attendant={data.attendant}
      trip={data.trip}
      bus={data.bus}
      initialStudents={data.students}
      initialLogs={data.logs}
      supabaseConfigured={data.supabaseConfigured}
    />
  );
}
