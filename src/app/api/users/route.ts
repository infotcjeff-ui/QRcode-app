import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase-server";
import { isValidUuid } from "@/lib/utils";
import type { User, UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_ROLES: UserRole[] = ["admin", "attendant"];

function badRequest(error: string) {
  return NextResponse.json({ success: false, error }, { status: 400 });
}

function configError() {
  return NextResponse.json(
    {
      success: false,
      error:
        "Supabase service role key 未設定或格式有誤。請在 Supabase Dashboard → Project Settings → API → service_role key，複製並貼入 .env.local 的 SUPABASE_SERVICE_ROLE_KEY。詳見 .env.local.example。",
      code: "CONFIG_ERROR",
    },
    { status: 500 }
  );
}

function rlsError() {
  return NextResponse.json(
    {
      success: false,
      error: "資料庫權限不足。請在 Supabase SQL Editor 執行：ALTER TABLE users DISABLE ROW LEVEL SECURITY;",
    },
    { status: 500 }
  );
}

export async function GET() {
  if (!isSupabaseAdminConfigured()) return configError();
  const supabase = getSupabaseAdmin();
  if (!supabase) return configError();

  const { data, error } = await supabase
    .from("users")
    .select("id, name, phone, role, assigned_bus_id")
    .order("name", { ascending: true });

  if (error) {
    console.error("[api/users] GET failed:", error.code, error.message);
    if (error.code === "42501" || error.message.includes("row-level security")) {
      return rlsError();
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: (data as User[]) ?? [] });
}

type UserPayload = Partial<{
  name: string;
  phone: string;
  role: UserRole;
  assigned_bus_id: string | null;
}>;

type ValidatedPayload = {
  name: string;
  phone: string;
  role: UserRole;
  assigned_bus_id: string | null;
};

function validatePayload(
  body: UserPayload,
  { requireRole = true }: { requireRole?: boolean } = {}
):
  | { error: string }
  | { payload: ValidatedPayload } {
  const name = (body.name ?? "").trim();
  const phone = (body.phone ?? "").trim();
  const role = body.role as UserRole | undefined;
  const assignedBusId =
    body.assigned_bus_id === undefined ? undefined : (body.assigned_bus_id ?? null);

  if (!name) return { error: "請填寫姓名。" };
  if (name.length > 100) return { error: "姓名過長 (最多 100 字)。" };
  if (!phone) return { error: "請填寫電話。" };
  if (phone.length > 50) return { error: "電話過長 (最多 50 字)。" };
  if (requireRole && (!role || !VALID_ROLES.includes(role))) return { error: "請選擇有效的角色。" };
  if (assignedBusId && assignedBusId !== null && !isValidUuid(assignedBusId)) {
    return { error: "指派校巴 ID 格式不正確。" };
  }
  return {
    payload: {
      name,
      phone,
      role: role as UserRole,
      assigned_bus_id: assignedBusId ?? null,
    },
  };
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured()) return configError();
  const supabase = getSupabaseAdmin();
  if (!supabase) return configError();

  let body: UserPayload;
  try {
    body = (await request.json()) as UserPayload;
  } catch {
    return badRequest("Invalid JSON payload.");
  }

  const v = validatePayload(body);
  if ("error" in v) return badRequest(v.error);
  const insertPayload = {
    name: v.payload.name,
    phone: v.payload.phone,
    role: v.payload.role,
    assigned_bus_id: v.payload.assigned_bus_id,
  };

  // 校驗指派的校巴 ID 是否存在
  if (insertPayload.assigned_bus_id) {
    const { data: busRow, error: busErr } = await supabase
      .from("buses")
      .select("id")
      .eq("id", insertPayload.assigned_bus_id)
      .maybeSingle();
    if (busErr) {
      console.error("[api/users] bus lookup failed:", busErr.code, busErr.message);
      return NextResponse.json({ success: false, error: busErr.message }, { status: 500 });
    }
    if (!busRow) return badRequest("指派的校巴不存在，請重新選擇。");
  }

  const { data, error } = await supabase
    .from("users")
    .insert(insertPayload)
    .select("id, name, phone, role, assigned_bus_id")
    .single();

  if (error) {
    console.error("[api/users] Insert failed:", error.code, error.message);
    if (error.code === "42501" || error.message.includes("row-level security")) return rlsError();
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  revalidatePath("/system-setting");
  revalidatePath("/system-setting/admin");
  return NextResponse.json({ success: true, data: data as User }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !isValidUuid(id)) return badRequest("Invalid user ID.");

  if (!isSupabaseAdminConfigured()) return configError();
  const supabase = getSupabaseAdmin();
  if (!supabase) return configError();

  let body: UserPayload;
  try {
    body = (await request.json()) as UserPayload;
  } catch {
    return badRequest("Invalid JSON payload.");
  }

  // 更新時允許 partial：只更新有提供的欄位
  const updatePayload: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const n = body.name.trim();
    if (!n) return badRequest("姓名不可為空。");
    if (n.length > 100) return badRequest("姓名過長 (最多 100 字)。");
    updatePayload.name = n;
  }
  if (typeof body.phone === "string") {
    const p = body.phone.trim();
    if (!p) return badRequest("電話不可為空。");
    if (p.length > 50) return badRequest("電話過長 (最多 50 字)。");
    updatePayload.phone = p;
  }
  if (body.role !== undefined) {
    if (!VALID_ROLES.includes(body.role)) return badRequest("無效的角色。");
    updatePayload.role = body.role;
  }
  if (body.assigned_bus_id !== undefined) {
    if (body.assigned_bus_id && !isValidUuid(body.assigned_bus_id)) {
      return badRequest("指派校巴 ID 格式不正確。");
    }
    updatePayload.assigned_bus_id = body.assigned_bus_id ?? null;
  }

  if (Object.keys(updatePayload).length === 0) {
    return badRequest("沒有提供要更新的欄位。");
  }

  // 若有指派校巴，確認存在
  if (typeof updatePayload.assigned_bus_id === "string") {
    const { data: busRow, error: busErr } = await supabase
      .from("buses")
      .select("id")
      .eq("id", updatePayload.assigned_bus_id)
      .maybeSingle();
    if (busErr) {
      console.error("[api/users] bus lookup failed:", busErr.code, busErr.message);
      return NextResponse.json({ success: false, error: busErr.message }, { status: 500 });
    }
    if (!busRow) return badRequest("指派的校巴不存在，請重新選擇。");
  }

  const { data, error } = await supabase
    .from("users")
    .update(updatePayload)
    .eq("id", id)
    .select("id, name, phone, role, assigned_bus_id")
    .single();

  if (error) {
    console.error("[api/users] Update failed:", error.code, error.message);
    if (error.code === "42501" || error.message.includes("row-level security")) {
      return NextResponse.json({ success: false, error: "資料庫權限不足。" }, { status: 500 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  revalidatePath("/system-setting");
  revalidatePath("/system-setting/admin");
  return NextResponse.json({ success: true, data: data as User });
}

export async function DELETE(request: NextRequest) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !isValidUuid(id)) return badRequest("Invalid user ID.");

  if (!isSupabaseAdminConfigured()) return configError();
  const supabase = getSupabaseAdmin();
  if (!supabase) return configError();

  // 先解除此用戶在 trips 表中的關聯 (避免外鍵錯誤)
  await supabase.from("trips").update({ nanny_id: null }).eq("nanny_id", id);

  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) {
    console.error("[api/users] Delete failed:", error.code, error.message);
    if (error.code === "42501" || error.message.includes("row-level security")) {
      return NextResponse.json({ success: false, error: "資料庫權限不足。" }, { status: 500 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  revalidatePath("/system-setting");
  revalidatePath("/system-setting/admin");
  return NextResponse.json({ success: true });
}