import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase-server";
import type { User, UserRole } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoginRequest = {
  role: UserRole;
  password: string;
};

type LoginResponse =
  | { success: true; user: Pick<User, "id" | "name" | "role">; demo?: boolean }
  | { success: false; error: string };

function bad(error: string, status = 400) {
  return NextResponse.json<LoginResponse>({ success: false, error }, { status });
}

/** 示範模式測試帳號密碼。 */
const DEMO_PASSWORDS: Record<UserRole, string> = {
  admin: "admin",
  nanny: "test",
};

/** 示範模式用戶資料。 */
const DEMO_USERS: Record<UserRole, { id: string; name: string }> = {
  admin: { id: "11111111-1111-1111-1111-111111111111", name: "陳大文主管" },
  nanny: { id: "22222222-2222-2222-2222-222222222222", name: "張翠蘭姐" },
};

/**
 * 透過密碼登入。
 * 若 Supabase 無法連線，則使用 DEMO_PASSWORDS 示範密碼。
 */
export async function POST(request: NextRequest) {
  let body: Partial<LoginRequest>;
  try {
    body = (await request.json()) as Partial<LoginRequest>;
  } catch {
    return bad("Invalid JSON payload.");
  }

  const role = body.role as UserRole | undefined;
  const password = (body.password ?? "").trim();

  if (!role || (role !== "admin" && role !== "nanny")) {
    return bad("無效的角色。");
  }
  if (!password) return bad("請輸入密碼。");

  // 嘗試 Supabase 登入（實作時可改為比對密碼欄位）。
  if (isSupabaseAdminConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("role", role)
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("[api/auth/login] Supabase error:", error.code, error.message);
        } else if (data) {
          const user = data as User;
          // TODO: 實作密碼比對（可加入 password_hash 欄位）。
          return NextResponse.json<LoginResponse>({
            success: true,
            user: { id: user.id, name: user.name, role: user.role },
          });
        }
      } catch (err) {
        console.error("[api/auth/login] Supabase fetch error:", err);
      }
    }
  }

  // 示範模式：比對密碼。
  if (password === DEMO_PASSWORDS[role]) {
    const demoUser = DEMO_USERS[role];
    console.info(`[api/auth/login] Demo login: ${demoUser.name} (${role})`);
    return NextResponse.json<LoginResponse>({
      success: true,
      user: { id: demoUser.id, name: demoUser.name, role },
      demo: true,
    });
  }

  const isSupabaseUp = isSupabaseAdminConfigured();
  const msg = isSupabaseUp
    ? "密碼錯誤。"
    : "密碼錯誤。示範密碼：「系統管理員」請輸入 admin，「打卡」請輸入 test。";
  return bad(msg, 401);
}
