import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase-server";
import { isValidUuid } from "@/lib/utils";
import type {
  CheckLogRequest,
  CheckLogResponse,
  CheckLogType,
  CheckLogWithStudent,
  Student,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES: CheckLogType[] = ["ON", "OFF"];

function badRequest(error: string, error_code: CheckLogResponse["error_code"]) {
  return NextResponse.json<CheckLogResponse>(
    { success: false, error, error_code },
    { status: 400 }
  );
}

function serverError(message: string) {
  return NextResponse.json<CheckLogResponse>(
    { success: false, error: message, error_code: "INVALID_PAYLOAD" },
    { status: 500 }
  );
}

function configError() {
  return NextResponse.json<CheckLogResponse>(
    {
      success: false,
      error: "Supabase service role key 未設定或格式有誤。請在 Supabase Dashboard → Project Settings → API → service_role key 填入 .env.local。",
      error_code: "CONFIG_ERROR",
    },
    { status: 500 }
  );
}

async function fireWhatsappNotification(payload: {
  student_id: string;
  trip_id: string;
  check_log_id: string;
  location_name?: string;
}) {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    await fetch(`${baseUrl}/api/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // Do not await response streaming to keep API latency low
    });
  } catch (err) {
    console.error("[check-log] Failed to dispatch WhatsApp notification", err);
  }
}

export async function POST(request: NextRequest) {
  let body: Partial<CheckLogRequest>;
  try {
    body = (await request.json()) as Partial<CheckLogRequest>;
  } catch {
    return badRequest("Invalid JSON payload.", "INVALID_PAYLOAD");
  }

  const { student_id, trip_id, type, location_name } = body;

  if (!student_id || !trip_id || !type) {
    return badRequest("Missing required fields: student_id, trip_id, type.", "INVALID_PAYLOAD");
  }

  if (!isValidUuid(student_id) || !isValidUuid(trip_id)) {
    return badRequest("student_id and trip_id must be valid UUID strings.", "INVALID_PAYLOAD");
  }

  if (!VALID_TYPES.includes(type)) {
    return badRequest("type must be either 'ON' or 'OFF'.", "INVALID_PAYLOAD");
  }

  if (!isSupabaseAdminConfigured()) {
    return configError();
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return configError();
  }

  const studentRes = await supabase
    .from("students")
    .select("*")
    .eq("id", student_id)
    .maybeSingle();

  if (studentRes.error) return serverError(`Student lookup failed: ${studentRes.error.message}`);
  const student = (studentRes.data as Student | null) ?? null;
  if (!student) return badRequest("Student not found in registry.", "INVALID_STUDENT");

  const tripRes = await supabase
    .from("trips")
    .select("*")
    .eq("id", trip_id)
    .maybeSingle();

  if (tripRes.error) return serverError(`Trip lookup failed: ${tripRes.error.message}`);
  const trip = tripRes.data;
  if (!trip) return badRequest("Active trip session not found.", "INVALID_TRIP");

  if (trip.status !== "active") {
    return badRequest("This trip is no longer active. Cannot accept check-ins.", "INVALID_TRIP");
  }

  const existingRes = await supabase
    .from("check_logs")
    .select("*")
    .eq("trip_id", trip_id)
    .eq("student_id", student_id);

  if (existingRes.error) {
    return serverError(`Check-log lookup failed: ${existingRes.error.message}`);
  }

  const existingLogs = (existingRes.data ?? []) as { id: string; type: CheckLogType; timestamp: string }[];

  const onLog = existingLogs.find((l) => l.type === "ON");
  const offLog = existingLogs.find((l) => l.type === "OFF");

  if (type === "ON") {
    if (onLog) {
      const ts = new Date(onLog.timestamp).toLocaleTimeString("zh-HK", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Hong_Kong",
      });
      return badRequest(
        `${student.name} 已於 ${ts} 完成上車打卡，請勿重複掃瞄。`,
        "DUPLICATE_ON"
      );
    }
  } else if (type === "OFF") {
    if (offLog) {
      return badRequest(
        `${student.name} 已完成落車下車，請勿重複掃瞄。`,
        "DUPLICATE_OFF"
      );
    }
    if (!onLog) {
      return badRequest(
        `${student.name} 尚未上車打卡，無法登記落車。請先完成上車掃瞄。`,
        "INVALID_PAYLOAD"
      );
    }
  }

  const insertRes = await supabase
    .from("check_logs")
    .insert({
      trip_id,
      student_id,
      type,
      location_name: location_name ?? null,
      whatsapp_status: "pending",
    })
    .select("*, student:students(*)")
    .single();

  if (insertRes.error || !insertRes.data) {
    return serverError(`Insert failed: ${insertRes.error?.message ?? "Unknown DB error"}`);
  }

  const inserted = insertRes.data as CheckLogWithStudent;

  if (type === "OFF") {
    void fireWhatsappNotification({
      student_id,
      trip_id,
      check_log_id: inserted.id,
      location_name: location_name ?? "未提供地點",
    });
  }

  return NextResponse.json<CheckLogResponse>({
    success: true,
    data: inserted,
  });
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: "Use POST to record check-in / check-out events.",
      error_code: "INVALID_PAYLOAD",
    },
    { status: 405 }
  );
}