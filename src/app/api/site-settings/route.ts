import { NextResponse } from "next/server";

/**
 * 站台設定狀態 API
 * 
 * 由於站台公開狀態儲存於 client-side localStorage，
 * 此 API 僅作為資訊端點，不提供實際的站台設定讀取。
 * 
 * 實際的站台公開狀態邏輯由 client-side 程式碼處理：
 * - 站台公開狀態 ON：需要站台密碼 → 導向 /lock
 * - 站台公開狀態 OFF：直接進入 login → 由 middleware 讀取 cookie `bus_site_public_off`
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      message: "站台設定狀態資訊端點。實際狀態由 client-side localStorage 管理。",
      cookieBased: true,
    },
  });
}
