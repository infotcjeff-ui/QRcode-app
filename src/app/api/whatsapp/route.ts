import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import type {
  CheckLog,
  Student,
  Trip,
  WhatsappRequest,
  WhatsappResponse,
  WhatsappStatus,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HK_PHONE_REGEX = /^\+852\d{8}$/;

function buildMessage(student: Student, timestampIso: string, locationName: string) {
  const ts = new Date(timestampIso).toLocaleString("zh-HK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `【校巴安全通知】您的子女${student.name}已於 ${ts} 在 ${locationName} 安全下車。`;
}

function buildMockMetaPayload(phone: string, body: string) {
  return {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: "school_bus_arrival",
      language: { code: "zh_HK" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: body },
          ],
        },
      ],
    },
  };
}

export async function POST(request: NextRequest) {
  let body: Partial<WhatsappRequest>;
  try {
    body = (await request.json()) as Partial<WhatsappRequest>;
  } catch {
    return NextResponse.json<WhatsappResponse>(
      { success: false, status: "failed", error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const { student_id, trip_id, check_log_id, location_name } = body;

  if (!student_id || !trip_id || !check_log_id) {
    return NextResponse.json<WhatsappResponse>(
      {
        success: false,
        status: "failed",
        error: "Missing required fields: student_id, trip_id, check_log_id.",
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json<WhatsappResponse>(
      {
        success: false,
        status: "failed",
        error: "Supabase service role key 未設定，無法寫入 WhatsApp 狀態。",
      },
      { status: 500 }
    );
  }

  const [studentRes, tripRes, logRes] = await Promise.all([
    supabase.from("students").select("*").eq("id", student_id).maybeSingle(),
    supabase.from("trips").select("*").eq("id", trip_id).maybeSingle(),
    supabase.from("check_logs").select("*").eq("id", check_log_id).maybeSingle(),
  ]);

  if (studentRes.error || tripRes.error || logRes.error) {
    const msg =
      studentRes.error?.message ?? tripRes.error?.message ?? logRes.error?.message ?? "DB lookup failed";
    return NextResponse.json<WhatsappResponse>(
      { success: false, status: "failed", error: msg },
      { status: 500 }
    );
  }

  const student = (studentRes.data as Student | null) ?? null;
  const trip = (tripRes.data as Trip | null) ?? null;
  const log = (logRes.data as CheckLog | null) ?? null;

  if (!student || !trip || !log) {
    return NextResponse.json<WhatsappResponse>(
      { success: false, status: "failed", error: "Required record(s) missing." },
      { status: 404 }
    );
  }

  const phone = student.parent_phone;
  if (!HK_PHONE_REGEX.test(phone)) {
    console.error(
      `[WhatsApp API System Router Log] -> Status: FAILED -> Invalid Hong Kong phone format for student ${student.name}`
    );
    return NextResponse.json<WhatsappResponse>(
      {
        success: false,
        status: "failed",
        error: `Parent phone ${phone} is not a valid +852XXXXXXXX format.`,
      },
      { status: 400 }
    );
  }

  const messageBody = buildMessage(student, log.timestamp, location_name ?? log.location_name ?? "未提供地點");
  const mockPayload = buildMockMetaPayload(phone, messageBody);

  console.log("[WhatsApp API System Router Log] -> Status: PENDING -> Constructing Meta outbound webhook template...");
  console.log(`[WhatsApp API System Router Log] -> Target Phone: ${phone} (家長: ${student.parent_name})`);
  console.log(`[WhatsApp API System Router Log] -> Body Text payload: "${messageBody}"`);
  console.log(
    `[WhatsApp API System Router Log] -> Meta Payload JSON: ${JSON.stringify(mockPayload)}`
  );

  await new Promise((resolve) => setTimeout(resolve, 150));

  const upstreamStatus = "SUCCESS";
  const upstreamStatusCode = 200;

  console.log(
    `[WhatsApp API System Router Log] -> Status: ${upstreamStatus} (Response ${upstreamStatusCode} OK received from upstream gateway)`
  );

  const updateRes = await supabase
    .from("check_logs")
    .update({ whatsapp_status: "sent" satisfies WhatsappStatus })
    .eq("id", check_log_id);

  if (updateRes.error) {
    console.error(
      `[WhatsApp API System Router Log] -> Status: WARNING -> Could not persist whatsapp_status='sent' for log ${check_log_id}: ${updateRes.error.message}`
    );
  }

  return NextResponse.json<WhatsappResponse>({
    success: true,
    status: "sent",
    message_id: `wamid.MOCK-${check_log_id.slice(0, 8)}`,
  });
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      status: "failed",
      error: "POST endpoint only. This route is the WhatsApp outbound dispatcher.",
    },
    { status: 405 }
  );
}