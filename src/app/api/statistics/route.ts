import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase-server";
import type {
  Bus,
  CheckLog,
  DailyStat,
  HourBucketStat,
  RouteStat,
  StatisticsGenerateRequest,
  StatisticsGenerateResponse,
  StatisticsListResponse,
  StatisticsReport,
  StatisticsReportFilters,
  StatisticsReportPayload,
  StatisticsReportType,
  Student,
  StudentAttendanceStat,
  Trip,
  TripTypeStat,
  User,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_REPORT_TYPES: StatisticsReportType[] = [
  "check_log_advanced",
  "check_log_route",
  "check_log_daily",
  "custom",
];

const VALID_TRIP_TYPES = new Set(["AM_GO", "PM_BACK", "ALL"]);

function configError(message?: string) {
  return NextResponse.json<StatisticsGenerateResponse>(
    {
      success: false,
      error:
        message ??
        "Supabase service role key 未設定或格式有誤。請在 .env.local 填入 SUPABASE_SERVICE_ROLE_KEY。",
    },
    { status: 500 }
  );
}

function badRequest(message: string) {
  return NextResponse.json<StatisticsGenerateResponse>(
    { success: false, error: message },
    { status: 400 }
  );
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

function clampTitle(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, 200);
}

function isUuid(value: string | null | undefined): boolean {
  return !!value && UUID_REGEX.test(value);
}

function emptyPayload(): StatisticsReportPayload {
  return {
    generated_at: new Date().toISOString(),
    range_start: "",
    range_end: "",
    total_check_logs: 0,
    total_on: 0,
    total_off: 0,
    unique_students: 0,
    unique_trips: 0,
    on_rate: 0,
    off_rate: 0,
    whatsapp_sent: 0,
    whatsapp_failed: 0,
    whatsapp_pending: 0,
    by_route: [],
    by_day: [],
    by_trip_type: [],
    by_hour: [],
    top_students: [],
    bottom_students: [],
  };
}

function buildAdvancedStats(
  logs: CheckLog[],
  trips: Trip[],
  students: Student[],
  buses: Bus[]
): StatisticsReportPayload {
  const payload = emptyPayload();

  // Top-level metrics
  payload.total_check_logs = logs.length;
  let totalOn = 0;
  let totalOff = 0;
  const studentSet = new Set<string>();
  const tripSet = new Set<string>();

  for (const log of logs) {
    if (log.type === "ON") totalOn += 1;
    else if (log.type === "OFF") totalOff += 1;
    studentSet.add(log.student_id);
    tripSet.add(log.trip_id);
  }
  payload.total_on = totalOn;
  payload.total_off = totalOff;
  payload.unique_students = studentSet.size;
  payload.unique_trips = tripSet.size;

  // 當 unique_students 為 0 時以 0% 表示，避免 NaN
  if (studentSet.size > 0) {
    payload.on_rate = totalOn === 0 ? 0 : Number(((totalOn / studentSet.size) * 100).toFixed(2));
    payload.off_rate = totalOff === 0 ? 0 : Number(((totalOff / studentSet.size) * 100).toFixed(2));
  }

  for (const log of logs) {
    if (log.whatsapp_status === "sent") payload.whatsapp_sent += 1;
    else if (log.whatsapp_status === "failed") payload.whatsapp_failed += 1;
    else payload.whatsapp_pending += 1;
  }

  // By Route
  const studentById = new Map<string, Student>();
  for (const s of students) studentById.set(s.id, s);
  const busById = new Map<string, Bus>();
  for (const b of buses) busById.set(b.id, b);

  const routeAcc = new Map<
    string,
    {
      bus_id: string | null;
      route_name: string;
      plate_number: string | null;
      total: number;
      on: number;
      off: number;
      students: Set<string>;
      ws_sent: number;
      ws_failed: number;
      ws_pending: number;
    }
  >();

  const UNASSIGNED_KEY = "__unassigned__";
  for (const log of logs) {
    const student = studentById.get(log.student_id);
    const bus = student?.assigned_bus_id ? busById.get(student.assigned_bus_id) : undefined;
    const key = bus?.id ?? UNASSIGNED_KEY;
    const acc =
      routeAcc.get(key) ??
      {
        bus_id: bus?.id ?? null,
        route_name: bus?.route_name ?? "未指派路線",
        plate_number: bus?.plate_number ?? null,
        total: 0,
        on: 0,
        off: 0,
        students: new Set<string>(),
        ws_sent: 0,
        ws_failed: 0,
        ws_pending: 0,
      };
    acc.total += 1;
    if (log.type === "ON") acc.on += 1;
    if (log.type === "OFF") acc.off += 1;
    acc.students.add(log.student_id);
    if (log.whatsapp_status === "sent") acc.ws_sent += 1;
    else if (log.whatsapp_status === "failed") acc.ws_failed += 1;
    else acc.ws_pending += 1;
    routeAcc.set(key, acc);
  }
  payload.by_route = Array.from(routeAcc.values())
    .map<RouteStat>((r) => ({
      bus_id: r.bus_id,
      route_name: r.route_name,
      plate_number: r.plate_number,
      total_check_logs: r.total,
      on_count: r.on,
      off_count: r.off,
      unique_students: r.students.size,
      whatsapp_sent: r.ws_sent,
      whatsapp_failed: r.ws_failed,
      whatsapp_pending: r.ws_pending,
    }))
    .sort((a, b) => b.total_check_logs - a.total_check_logs);

  // By Day
  const dayAcc = new Map<
    string,
    {
      date: string;
      total: number;
      on: number;
      off: number;
      students: Set<string>;
    }
  >();
  for (const log of logs) {
    const ts = new Date(log.timestamp);
    const isoDay = ts.toISOString().slice(0, 10);
    const acc =
      dayAcc.get(isoDay) ??
      { date: isoDay, total: 0, on: 0, off: 0, students: new Set<string>() };
    acc.total += 1;
    if (log.type === "ON") acc.on += 1;
    if (log.type === "OFF") acc.off += 1;
    acc.students.add(log.student_id);
    dayAcc.set(isoDay, acc);
  }
  payload.by_day = Array.from(dayAcc.values())
    .map<DailyStat>((d) => ({
      date: d.date,
      total_check_logs: d.total,
      on_count: d.on,
      off_count: d.off,
      unique_students: d.students.size,
      on_rate: d.students.size === 0 ? 0 : Number(((d.on / d.students.size) * 100).toFixed(2)),
      off_rate: d.students.size === 0 ? 0 : Number(((d.off / d.students.size) * 100).toFixed(2)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // By Hour bucket
  const hourAcc = new Map<number, { on: number; off: number }>();
  for (let h = 0; h < 24; h += 1) hourAcc.set(h, { on: 0, off: 0 });
  for (const log of logs) {
    const hour = new Date(log.timestamp).getUTCHours();
    const acc = hourAcc.get(hour)!;
    if (log.type === "ON") acc.on += 1;
    else if (log.type === "OFF") acc.off += 1;
  }
  payload.by_hour = Array.from(hourAcc.entries())
    .map<HourBucketStat>(([hour, v]) => ({ hour, on_count: v.on, off_count: v.off }))
    .filter((h) => h.on_count > 0 || h.off_count > 0);

  // By Trip Type
  const tripById = new Map<string, Trip>();
  for (const t of trips) tripById.set(t.id, t);

  const tripTypeAcc = new Map<
    string,
    {
      on: number;
      off: number;
      trips: Set<string>;
      students: Set<string>;
    }
  >();
  for (const log of logs) {
    const trip = tripById.get(log.trip_id);
    const type = trip?.type ?? "UNKNOWN";
    const acc =
      tripTypeAcc.get(type) ??
      { on: 0, off: 0, trips: new Set<string>(), students: new Set<string>() };
    if (log.type === "ON") acc.on += 1;
    if (log.type === "OFF") acc.off += 1;
    acc.trips.add(log.trip_id);
    acc.students.add(log.student_id);
    tripTypeAcc.set(type, acc);
  }
  payload.by_trip_type = Array.from(tripTypeAcc.entries())
    .map<TripTypeStat>(([type, v]) => ({
      trip_type: type as TripTypeStat["trip_type"],
      on_count: v.on,
      off_count: v.off,
      unique_trips: v.trips.size,
      unique_students: v.students.size,
    }))
    .sort((a, b) => b.on_count + b.off_count - (a.on_count + a.off_count));

  // Per-student attendance
  const studentAcc = new Map<
    string,
    { on: number; off: number; days: Set<string> }
  >();
  for (const log of logs) {
    const acc =
      studentAcc.get(log.student_id) ?? { on: 0, off: 0, days: new Set<string>() };
    if (log.type === "ON") acc.on += 1;
    if (log.type === "OFF") acc.off += 1;
    acc.days.add(new Date(log.timestamp).toISOString().slice(0, 10));
    studentAcc.set(log.student_id, acc);
  }

  const perStudent: StudentAttendanceStat[] = [];
  for (const [studentId, acc] of studentAcc.entries()) {
    const student = studentById.get(studentId);
    if (!student) continue;
    const bus = student.assigned_bus_id ? busById.get(student.assigned_bus_id) : undefined;
    const tripDays = acc.days.size || 1;
    perStudent.push({
      student_id: studentId,
      student_name: student.name,
      student_no: student.student_no,
      assigned_route: bus?.route_name ?? "未指派路線",
      on_count: acc.on,
      off_count: acc.off,
      trip_days: acc.days.size,
      attendance_rate: Number((acc.on / tripDays).toFixed(2)),
    });
  }
  perStudent.sort((a, b) => b.attendance_rate - a.attendance_rate);
  payload.top_students = perStudent.slice(0, 5);
  payload.bottom_students = perStudent.slice(-5).reverse();

  return payload;
}

function buildSummary(payload: StatisticsReportPayload): string {
  if (payload.total_check_logs === 0) {
    return "此區間內沒有任何打卡紀錄。請調整日期區間後再試。";
  }
  return `共 ${payload.total_check_logs} 筆打卡；上車 ${payload.total_on} / 落車 ${payload.total_off}；涵蓋 ${payload.unique_students} 位學生 / ${payload.unique_trips} 個班次；上車率 ${payload.on_rate}%，落車率 ${payload.off_rate}%。`;
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured()) return configError();
  const supabase = getSupabaseAdmin();
  if (!supabase) return configError();

  let body: Partial<StatisticsGenerateRequest>;
  try {
    body = (await request.json()) as Partial<StatisticsGenerateRequest>;
  } catch {
    return badRequest("Invalid JSON payload.");
  }

  const rangeStart = body.range_start;
  const rangeEnd = body.range_end;
  if (!rangeStart || !rangeEnd) {
    return badRequest("range_start 與 range_end 為必填 (YYYY-MM-DD)。");
  }
  if (!isValidIsoDate(rangeStart) || !isValidIsoDate(rangeEnd)) {
    return badRequest("日期格式錯誤，請使用 YYYY-MM-DD。");
  }
  if (rangeStart > rangeEnd) {
    return badRequest("range_start 不可晚於 range_end。");
  }

  const reportType = (body.report_type ?? "check_log_advanced") as StatisticsReportType;
  if (!VALID_REPORT_TYPES.includes(reportType)) {
    return badRequest(`report_type 不合法：${reportType}`);
  }

  const filters: StatisticsReportFilters = body.filters ?? {};
  if (filters.trip_type && !VALID_TRIP_TYPES.has(filters.trip_type)) {
    return badRequest("filters.trip_type 不合法。");
  }
  if (filters.bus_id && !isUuid(filters.bus_id)) {
    return badRequest("filters.bus_id 必須為 UUID。");
  }
  if (filters.attendant_id && !isUuid(filters.attendant_id)) {
    return badRequest("filters.attendant_id 必須為 UUID。");
  }

  // 1. 撈出指定區間內的 check_logs（透過 trip.date 做關聯，避免大量讀取全表）
  const { data: tripsInRange, error: tripsErr } = await supabase
    .from("trips")
    .select("*")
    .gte("date", rangeStart)
    .lte("date", rangeEnd);

  if (tripsErr) {
    return NextResponse.json<StatisticsGenerateResponse>(
      { success: false, error: `Trip 查詢失敗：${tripsErr.message}` },
      { status: 500 }
    );
  }

  const trips: Trip[] = (tripsInRange as Trip[] | null) ?? [];

  let tripIds = trips.map((t) => t.id);
  if (filters.trip_type && filters.trip_type !== "ALL") {
    tripIds = trips.filter((t) => t.type === filters.trip_type).map((t) => t.id);
  }
  if (filters.bus_id) {
    tripIds = tripIds.filter((id) => trips.find((t) => t.id === id)?.bus_id === filters.bus_id);
  }
  if (filters.attendant_id) {
    tripIds = tripIds.filter((id) => trips.find((t) => t.id === id)?.attendant_id === filters.attendant_id);
  }
  if (filters.route_name) {
    const { data: busesRes, error: busesErr } = await supabase
      .from("buses")
      .select("id, route_name")
      .eq("route_name", filters.route_name);
    if (busesErr) {
      return NextResponse.json<StatisticsGenerateResponse>(
        { success: false, error: `Bus 查詢失敗：${busesErr.message}` },
        { status: 500 }
      );
    }
    const ids = new Set(((busesRes as { id: string }[] | null) ?? []).map((b) => b.id));
    tripIds = tripIds.filter((id) => {
      const t = trips.find((tr) => tr.id === id);
      return t ? ids.has(t.bus_id) : false;
    });
  }

  let logs: CheckLog[] = [];
  if (tripIds.length > 0) {
    const { data: logsRes, error: logsErr } = await supabase
      .from("check_logs")
      .select("*")
      .in("trip_id", tripIds)
      .gte("timestamp", `${rangeStart}T00:00:00Z`)
      .lte("timestamp", `${rangeEnd}T23:59:59Z`);

    if (logsErr) {
      return NextResponse.json<StatisticsGenerateResponse>(
        { success: false, error: `Check-log 查詢失敗：${logsErr.message}` },
        { status: 500 }
      );
    }
    logs = (logsRes as CheckLog[] | null) ?? [];
  }

  // 同時取 students / buses，供聚合使用
  const [studentsRes, busesRes] = await Promise.all([
    supabase.from("students").select("*"),
    supabase.from("buses").select("*"),
  ]);
  const students: Student[] = (studentsRes.data as Student[] | null) ?? [];
  const buses: Bus[] = (busesRes.data as Bus[] | null) ?? [];

  const payload = buildAdvancedStats(logs, trips, students, buses);
  payload.range_start = rangeStart;
  payload.range_end = rangeEnd;
  payload.generated_at = new Date().toISOString();

  const summary = buildSummary(payload);
  const fallbackTitle = `${rangeStart} ~ ${rangeEnd} 打卡進階統計`;
  const title = clampTitle(body.title, fallbackTitle);

  const insertRes = await supabase
    .from("statistics_reports")
    .insert({
      title,
      report_type: reportType,
      range_start: rangeStart,
      range_end: rangeEnd,
      filters,
      payload,
      summary,
    })
    .select("*")
    .single();

  if (insertRes.error || !insertRes.data) {
    return NextResponse.json<StatisticsGenerateResponse>(
      {
        success: false,
        error: `報表寫入失敗：${insertRes.error?.message ?? "未知錯誤"}`,
      },
      { status: 500 }
    );
  }

  revalidatePath("/system-setting/admin/statistics");
  revalidatePath("/system-setting");

  return NextResponse.json<StatisticsGenerateResponse>({
    success: true,
    data: insertRes.data as StatisticsReport,
  });
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured()) return configError();
  const supabase = getSupabaseAdmin();
  if (!supabase) return configError();

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "20") || 20, 100);
  const reportType = searchParams.get("report_type") as StatisticsReportType | null;

  let query = supabase
    .from("statistics_reports")
    .select("*")
    .order("generated_at", { ascending: false })
    .limit(limit);

  if (reportType && VALID_REPORT_TYPES.includes(reportType)) {
    query = query.eq("report_type", reportType);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json<StatisticsListResponse>(
      { success: false, error: `報表查詢失敗：${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json<StatisticsListResponse>({
    success: true,
    data: (data as StatisticsReport[] | null) ?? [],
  });
}

export async function DELETE(request: NextRequest) {
  if (!isSupabaseAdminConfigured()) return configError();
  const supabase = getSupabaseAdmin();
  if (!supabase) return configError();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id || !isUuid(id)) {
    return NextResponse.json(
      { success: false, error: "請提供有效的報表 id。" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("statistics_reports").delete().eq("id", id);
  if (error) {
    return NextResponse.json(
      { success: false, error: `報表刪除失敗：${error.message}` },
      { status: 500 }
    );
  }

  revalidatePath("/system-setting/admin/statistics");

  return NextResponse.json({ success: true });
}