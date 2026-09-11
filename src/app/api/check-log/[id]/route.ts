import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase-server";
import { isValidUuid } from "@/lib/utils";
import type {
  CheckLogDeleteRequest,
  CheckLogDeleteResponse,
  CheckLogType,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/check-log/[id]
 *  - 取消單筆打卡紀錄 (僅限 admin)
 *  - Body: { cancelled_by_user_id, cancelled_by_name, reason? }
 *  - 取消後該學生即可重新掃瞄登記上/落車
 */
export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const logId = context.params?.id ?? "";

  if (!isValidUuid(logId)) {
    return NextResponse.json<CheckLogDeleteResponse>(
      {
        success: false,
        error: "check_log id 必須是有效的 UUID。",
        error_code: "INVALID_PAYLOAD",
      },
      { status: 400 }
    );
  }

  // 解析 body (選擇性，僅供 audit 用)
  let body: Partial<CheckLogDeleteRequest> = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as Partial<CheckLogDeleteRequest>;
  } catch {
    return NextResponse.json<CheckLogDeleteResponse>(
      {
        success: false,
        error: "Invalid JSON payload.",
        error_code: "INVALID_PAYLOAD",
      },
      { status: 400 }
    );
  }

  const cancelledByUserId = body.cancelled_by_user_id ?? null;
  const cancelledByName = body.cancelled_by_name ?? null;
  const reason = body.reason ?? null;

  if (cancelledByUserId && !isValidUuid(cancelledByUserId)) {
    return NextResponse.json<CheckLogDeleteResponse>(
      {
        success: false,
        error: "cancelled_by_user_id 必須是有效的 UUID。",
        error_code: "INVALID_PAYLOAD",
      },
      { status: 400 }
    );
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json<CheckLogDeleteResponse>(
      {
        success: false,
        error: "Supabase service role key 未設定或格式有誤。請在 .env.local 設定後再試。",
        error_code: "CONFIG_ERROR",
      },
      { status: 500 }
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json<CheckLogDeleteResponse>(
      {
        success: false,
        error: "無法建立 Supabase 管理員 client。",
        error_code: "CONFIG_ERROR",
      },
      { status: 500 }
    );
  }

  // 1) 先查詢原紀錄 (用於 audit log 與刪除前的存在性確認)
  const lookupRes = await supabase
    .from("check_logs")
    .select("id, trip_id, student_id, type, timestamp")
    .eq("id", logId)
    .maybeSingle();

  if (lookupRes.error) {
    return NextResponse.json<CheckLogDeleteResponse>(
      {
        success: false,
        error: `查詢打卡紀錄失敗：${lookupRes.error.message}`,
        error_code: "INVALID_PAYLOAD",
      },
      { status: 500 }
    );
  }

  const targetLog = lookupRes.data as {
    id: string;
    trip_id: string;
    student_id: string;
    type: CheckLogType;
    timestamp: string;
  } | null;

  if (!targetLog) {
    return NextResponse.json<CheckLogDeleteResponse>(
      {
        success: false,
        error: "找不到對應的打卡紀錄，可能已被取消或不存在。",
        error_code: "NOT_FOUND",
      },
      { status: 404 }
    );
  }

  // 2) 寫入 audit log (伺服器端 console；未來可改為寫入專用 audit_logs 資料表)
  console.info(
    "[check-log] CANCEL",
    JSON.stringify({
      action: "CANCEL_CHECK_LOG",
      log_id: targetLog.id,
      trip_id: targetLog.trip_id,
      student_id: targetLog.student_id,
      type: targetLog.type,
      original_timestamp: targetLog.timestamp,
      cancelled_by_user_id: cancelledByUserId,
      cancelled_by_name: cancelledByName,
      reason,
      cancelled_at: new Date().toISOString(),
    })
  );

  // 3) 刪除原紀錄 (硬刪除，確保後續 POST 不會被 DUPLICATE 邏輯擋下)
  const deleteRes = await supabase.from("check_logs").delete().eq("id", logId);

  if (deleteRes.error) {
    return NextResponse.json<CheckLogDeleteResponse>(
      {
        success: false,
        error: `刪除打卡紀錄失敗：${deleteRes.error.message}`,
        error_code: "INVALID_PAYLOAD",
      },
      { status: 500 }
    );
  }

  return NextResponse.json<CheckLogDeleteResponse>({
    success: true,
    data: {
      deleted_log_id: targetLog.id,
      trip_id: targetLog.trip_id,
      student_id: targetLog.student_id,
      type: targetLog.type,
    },
  });
}
