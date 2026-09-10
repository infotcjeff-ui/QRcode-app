import { NextResponse, type NextRequest } from "next/server";

const SITE_ACCESS_COOKIE = "bus_site_access";

/**
 * 路徑白名單 — 不需密碼也可瀏覽。
 *  - /lock: 密碼輸入頁本身
 *  - /api/: API 路由由各自的商業邏輯保護，不受此 Middleware 控制
 *  - /_next/: Next.js 內部靜態資源
 *  - /favicon.ico
 */
const PUBLIC_PATHS: string[] = [
  "/lock",
  "/favicon.ico",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p)) return true;
  // API 路由不受密碼保護，由各端點自行驗證。
  if (pathname.startsWith("/api/")) return true;
  // Next.js 靜態資源。
  if (pathname.startsWith("/_next/")) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(SITE_ACCESS_COOKIE)?.value;
  if (!cookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/lock";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     *  - _next/static (static files)
     *  - _next/image (image optimization files)
     *  - favicon.ico (favicon file)
     *  - /api/ routes are allowed through (each API handles its own auth)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
