import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase-server";
import { isValidUuid } from "@/lib/utils";
import { uuidFromStudentNo } from "@/lib/uuid";
import type { Student } from "@/lib/types";

export const dynamic = "force-dynamic";

const PHONE_REGEX = /^\+852\d{8}$/;

export async function GET(request: NextRequest) {
  const limitParam = new URL(request.url).searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitParam ?? 200) || 200, 1), 500);

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Supabase service role key 未設定，無法讀取資料。請設定 .env.local。",
      },
      { status: 500 }
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Supabase client 初始化失敗。" },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("students")
    .select("id, name, student_no, photo_url, parent_name, parent_phone, assigned_bus_id")
    .order("student_no", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[api/students] GET failed:", error.code, error.message);
    const isRls = error.code === "42501" || error.message.includes("row-level security");
    if (isRls) {
      return NextResponse.json(
        {
          success: false,
          error: "資料庫權限不足。請在 Supabase SQL Editor 執行：ALTER TABLE students DISABLE ROW LEVEL SECURITY;",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: (data as Student[]) ?? [],
  });
}

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

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured()) {
    return configError();
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return configError();
  }

  let body: Partial<{
    name: string;
    student_no: string;
    photo_url: string | null;
    parent_name: string;
    parent_phone: string;
    assigned_bus_id: string;
  }>;

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("Invalid JSON payload.");
  }

  const { name, student_no, photo_url, parent_name, parent_phone, assigned_bus_id } = body;

  if (!name?.trim() || !student_no?.trim() || !parent_name?.trim() || !parent_phone?.trim()) {
    return badRequest("name, student_no, parent_name, parent_phone are required.");
  }
  if (!PHONE_REGEX.test(parent_phone)) {
    return badRequest("parent_phone must be in format +852XXXXXXXX.");
  }
  if (assigned_bus_id && !isValidUuid(assigned_bus_id)) {
    return badRequest("assigned_bus_id must be a valid UUID.");
  }

  const { data, error } = await supabase
    .from("students")
    .insert({
      id: uuidFromStudentNo(student_no.trim()),
      name: name.trim(),
      student_no: student_no.trim(),
      photo_url: photo_url?.trim() || null,
      parent_name: parent_name.trim(),
      parent_phone: parent_phone.trim(),
      assigned_bus_id: assigned_bus_id || null,
    })
    .select("id, name, student_no, photo_url, parent_name, parent_phone, assigned_bus_id")
    .single();

  if (error) {
    console.error("[api/students] Insert failed:", error.code, error.message);

    if (error.code === "23505") {
      return NextResponse.json(
        { success: false, error: `學號「${student_no}」已存在，請使用不同學號。`, code: "DUPLICATE_STUDENT_NO" },
        { status: 409 }
      );
    }

    const isRls = error.code === "42501" || error.message.includes("row-level security");
    if (isRls) {
      return NextResponse.json(
        {
          success: false,
          error: "資料庫權限不足。請在 Supabase SQL Editor 執行：ALTER TABLE students DISABLE ROW LEVEL SECURITY;",
          code: "RLS_ERROR",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  revalidatePath("/system-setting/admin/students");
  revalidatePath("/scan");
  return NextResponse.json({ success: true, data: data as Student }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id || !isValidUuid(id)) {
    return badRequest("Invalid student ID.");
  }

  if (!isSupabaseAdminConfigured()) return configError();
  const supabase = getSupabaseAdmin();
  if (!supabase) return configError();

  let body: Partial<{
    name: string;
    student_no: string;
    photo_url: string | null;
    parent_name: string;
    parent_phone: string;
    assigned_bus_id: string;
  }>;

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("Invalid JSON payload.");
  }

  const { name, student_no, photo_url, parent_name, parent_phone, assigned_bus_id } = body;

  if (!name?.trim() || !student_no?.trim() || !parent_name?.trim() || !parent_phone?.trim()) {
    return badRequest("name, student_no, parent_name, parent_phone are required.");
  }
  if (!PHONE_REGEX.test(parent_phone)) {
    return badRequest("parent_phone must be in format +852XXXXXXXX.");
  }
  if (assigned_bus_id && !isValidUuid(assigned_bus_id)) {
    return badRequest("assigned_bus_id must be a valid UUID.");
  }

  const { data, error } = await supabase
    .from("students")
    .update({
      name: name.trim(),
      student_no: student_no.trim(),
      photo_url: photo_url?.trim() || null,
      parent_name: parent_name.trim(),
      parent_phone: parent_phone.trim(),
      assigned_bus_id: assigned_bus_id || null,
    })
    .eq("id", id)
    .select("id, name, student_no, photo_url, parent_name, parent_phone, assigned_bus_id")
    .single();

  if (error) {
    console.error("[api/students] Update failed:", error.code, error.message);
    const isRls = error.code === "42501" || error.message.includes("row-level security");
    if (isRls) {
      return NextResponse.json({ success: false, error: "資料庫權限不足。" }, { status: 500 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  revalidatePath("/system-setting/admin/students");
  revalidatePath("/scan");
  return NextResponse.json({ success: true, data: data as Student });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id || !isValidUuid(id)) {
    return badRequest("Invalid student ID.");
  }

  if (!isSupabaseAdminConfigured()) return configError();
  const supabase = getSupabaseAdmin();
  if (!supabase) return configError();

  const { error } = await supabase.from("students").delete().eq("id", id);

  if (error) {
    console.error("[api/students] Delete failed:", error.code, error.message);
    const isRls = error.code === "42501" || error.message.includes("row-level security");
    if (isRls) {
      return NextResponse.json({ success: false, error: "資料庫權限不足。" }, { status: 500 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
