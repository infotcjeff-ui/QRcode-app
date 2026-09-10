/**
 * Authentication helpers for the bus check-in system.
 *
 *  - `siteAccess`: cookie-based gate that protects every page from public view.
 *  - `authUser`:   localStorage-backed record of the currently signed-in user.
 *  - `sitePassword`: shared password the entire webapp requires before login.
 */

import type { User, UserRole } from "@/lib/types";

export const SITE_ACCESS_COOKIE = "bus_site_access";
export const SITE_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 小時後自動失效，需重新輸入密碼。

// 默認密碼。正式使用時請於 .env.local 設定 NEXT_PUBLIC_SITE_PASSWORD。
export const SITE_PASSWORD: string = process.env.NEXT_PUBLIC_SITE_PASSWORD ?? "bus2026";

const AUTH_USER_KEY = "bus-auth-user";

/* --------------------------- Site-wide access --------------------------- */

export function setSiteAccessCookie(value: string = "granted"): void {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + SITE_ACCESS_MAX_AGE_SECONDS * 1000).toUTCString();
  document.cookie = `${SITE_ACCESS_COOKIE}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function clearSiteAccessCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SITE_ACCESS_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

export function verifySitePassword(input: string): boolean {
  if (!input) return false;
  return input.trim() === SITE_PASSWORD;
}

/* --------------------------- User auth (localStorage) --------------------------- */

export type AuthUser = Pick<User, "id" | "name" | "role"> & { phone?: string };

export function getAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed || typeof parsed !== "object" || !parsed.id || !parsed.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setAuthUser(user: AuthUser): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event("bus-auth-user-changed"));
}

export function clearAuthUser(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_USER_KEY);
  window.dispatchEvent(new Event("bus-auth-user-changed"));
}

/* --------------------------- Role helpers --------------------------- */

export function isAdmin(user: AuthUser | null): boolean {
  return !!user && user.role === "admin";
}

export function isNanny(user: AuthUser | null): boolean {
  return !!user && user.role === "nanny";
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "系統管理員",
  nanny: "保姆",
};

export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  admin: "管理學生、列印 QR Code、查看全校即時狀態。",
  nanny: "使用手機鏡頭掃描學生 QR Code 完成上下車打卡。",
};
