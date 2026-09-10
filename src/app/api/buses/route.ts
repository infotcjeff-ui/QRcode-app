import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase-server";
import { isValidUuid } from "@/lib/utils";
import type { Bus } from "@/lib/types";

export const dynamic = "force-dynamic";

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

export async function GET() {
  if (!isSupabaseAdminConfigured()) return configError();
  const supabase = getSupabaseAdmin();
  if (!supabase) return configError();

  const { data, error } = await supabase
    .from("buses")
    .select("id, plate_number, route_name, capacity")
    .order("route_name", { ascending: true });

  if (error) {
    console.error("[api/buses] GET failed:", error.code, error.message);
    const isRls = error.code === "42501" || error.message.includes("row-level security");
    if (isRls) {
      return NextResponse.json(
        {
          success: false,
          error: "資料庫權限不足。請在 Supabase SQL Editor 執行：ALTER TABLE buses DISABLE ROW LEVEL SECURITY;",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: (data as Bus[]) ?? [] });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured()) return configError();
  const supabase = getSupabaseAdmin();
  if (!supabase) return configError();

  let body: Partial<{
    plate_number: string;
    route_name: string;
    capacity: number;
  }>;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("Invalid JSON payload.");
  }

  const plate = body.plate_number?.trim();
  const route = body.route_name?.trim();
  const capacity = Number(body.capacity ?? 0);

  if (!plate) return badRequest("請填寫車牌號碼。");
  if (!route) return badRequest("請填寫路線名稱。");
  if (!Number.isFinite(capacity) || capacity < 1 || capacity > 99) {
    return badRequest("載客量必須是 1–99 的數字。");
  }

  const { data, error } = await supabase
    .from("buses")
    .insert({
      plate_number: plate,
      route_name: route,
      capacity,
    })
    .select("id, plate_number, route_name, capacity")
    .single();

  if (error) {
    console.error("[api/buses] Insert failed:", error.code, error.message);
    const isRls = error.code === "42501" || error.message.includes("row-level security");
    if (isRls) {
      return NextResponse.json(
        {
          success: false,
          error: "資料庫權限不足。請在 Supabase SQL Editor 執行：ALTER TABLE buses DISABLE ROW LEVEL SECURITY;",
        },
        { status: 500 }
      );
    }
    if (error.code === "23505") {
      return NextResponse.json(
        { success: false, error: `車牌「${plate}」已存在。`, code: "DUPLICATE_PLATE" },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  revalidatePath("/system-setting");
  revalidatePath("/system-setting/admin");
  return NextResponse.json({ success: true, data: data as Bus }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !isValidUuid(id)) return badRequest("Invalid bus ID.");

  if (!isSupabaseAdminConfigured()) return configError();
  const supabase = getSupabaseAdmin();
  if (!supabase) return configError();

  let body: Partial<{
    plate_number: string;
    route_name: string;
    capacity: number;
  }>;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("Invalid JSON payload.");
  }

  const plate = body.plate_number?.trim();
  const route = body.route_name?.trim();
  const capacity = Number(body.capacity ?? 0);

  if (!plate) return badRequest("請填寫車牌號碼。");
  if (!route) return badRequest("請填寫路線名稱。");
  if (!Number.isFinite(capacity) || capacity < 1 || capacity > 99) {
    return badRequest("載客量必須是 1–99 的數字。");
  }

  const { data, error } = await supabase
    .from("buses")
    .update({
      plate_number: plate,
      route_name: route,
      capacity,
    })
    .eq("id", id)
    .select("id, plate_number, route_name, capacity")
    .single();

  if (error) {
    console.error("[api/buses] Update failed:", error.code, error.message);
    const isRls = error.code === "42501" || error.message.includes("row-level security");
    if (isRls) {
      return NextResponse.json({ success: false, error: "資料庫權限不足。" }, { status: 500 });
    }
    if (error.code === "23505") {
      return NextResponse.json(
        { success: false, error: `車牌「${plate}」與其他校巴重複。`, code: "DUPLICATE_PLATE" },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  revalidatePath("/system-setting");
  revalidatePath("/system-setting/admin");
  return NextResponse.json({ success: true, data: data as Bus });
}

export async function DELETE(request: NextRequest) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !isValidUuid(id)) return badRequest("Invalid bus ID.");

  if (!isSupabaseAdminConfigured()) return configError();
  const supabase = getSupabaseAdmin();
  if (!supabase) return configError();

  // 先解除已經被指派到此車的學生 (避免外鍵錯誤)
  await supabase.from("students").update({ assigned_bus_id: null }).eq("assigned_bus_id", id);

  const { error } = await supabase.from("buses").delete().eq("id", id);
  if (error) {
    console.error("[api/buses] Delete failed:", error.code, error.message);
    const isRls = error.code === "42501" || error.message.includes("row-level security");
    if (isRls) {
      return NextResponse.json({ success: false, error: "資料庫權限不足。" }, { status: 500 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  revalidatePath("/system-setting");
  revalidatePath("/system-setting/admin");
  return NextResponse.json({ success: true });
}
