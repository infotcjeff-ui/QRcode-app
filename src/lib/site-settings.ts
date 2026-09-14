/**
 * 站台層級設定 (Site-wide Settings)
 * ---------------------------------
 * 站台公開狀態邏輯 (2026-09-14 更新):
 *  - 開啟：進入頁面時必先通過站台密碼，才可進入 login page
 *  - 關閉：站台密碼頁停用，直接進入 login page 登入流程
 *
 * 實作方式：以 localStorage 儲存於管理員 / 此裝置。
 *  - localStorage 屬於 client-only；SSR 期間呼叫需先檢查 `typeof window !== "undefined"`。
 *  - 為避免跨頁競態，所有 setter 都會 dispatch `bus-site-settings-changed` 事件，
 *    讓 /lock 頁面與站台設定 UI 即時同步。
 */

export const SITE_PUBLIC_ENABLED_KEY = "bus-site-public-enabled";
export const SITE_PASSWORD_OVERRIDE_KEY = "bus-site-password-override";
export const SYSTEM_TITLE_KEY = "bus-system-title";

/** 站台設定異動事件名稱。 */
export const SITE_SETTINGS_EVENT = "bus-site-settings-changed";

/** 系統標題預設值 */
export const DEFAULT_SYSTEM_TITLE = "校巴安全打卡系統";

/** 系統標題最大長度 */
export const SYSTEM_TITLE_MAX_LENGTH = 30;

function safeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/* --------------------------- 站台公開狀態 --------------------------- */

/**
 * 取得站台公開狀態。
 * - 開啟 (true)：需要輸入站台密碼才能進入 login page
 * - 關閉 (false)：跳過鎖定頁，直接進入 login page
 * 預設為關閉 (false)。
 */
export function getSitePublicEnabled(): boolean {
  const store = safeStorage();
  if (!store) return false;
  return store.getItem(SITE_PUBLIC_ENABLED_KEY) === "1";
}

/**
 * 設定站台公開狀態。並廣播事件。
 * @param enabled true = 開啟（需要密碼），false = 關閉（跳過鎖定頁）
 */
export function setSitePublicEnabled(enabled: boolean): void {
  const store = safeStorage();
  if (!store) return;
  if (enabled) {
    store.setItem(SITE_PUBLIC_ENABLED_KEY, "1");
  } else {
    store.removeItem(SITE_PUBLIC_ENABLED_KEY);
  }
  broadcastChange();
}

/* --------------------------- 站台密碼覆寫 --------------------------- */

/** 取得站台密碼覆寫值。若無覆寫則回傳 null。 */
export function getSitePasswordOverride(): string | null {
  const store = safeStorage();
  if (!store) return null;
  const v = store.getItem(SITE_PASSWORD_OVERRIDE_KEY);
  return v && v.length > 0 ? v : null;
}

/** 設定站台密碼覆寫值。傳入空字串會清除覆寫。並廣播事件。 */
export function setSitePasswordOverride(password: string | null): void {
  const store = safeStorage();
  if (!store) return;
  if (password && password.length > 0) {
    store.setItem(SITE_PASSWORD_OVERRIDE_KEY, password);
  } else {
    store.removeItem(SITE_PASSWORD_OVERRIDE_KEY);
  }
  broadcastChange();
}

/* --------------------------- 系統標題 --------------------------- */

/** 取得系統標題。若無自訂值則回傳預設標題。 */
export function getSystemTitle(): string {
  const store = safeStorage();
  if (!store) return DEFAULT_SYSTEM_TITLE;
  const v = store.getItem(SYSTEM_TITLE_KEY);
  if (!v || v.trim().length === 0) return DEFAULT_SYSTEM_TITLE;
  return v;
}

/**
 * 設定系統標題。空字串會還原為預設值。
 * 自動 trim 並限制長度。並廣播事件。
 */
export function setSystemTitle(title: string): void {
  const store = safeStorage();
  if (!store) return;
  const trimmed = (title ?? "").trim().slice(0, SYSTEM_TITLE_MAX_LENGTH);
  if (trimmed.length === 0 || trimmed === DEFAULT_SYSTEM_TITLE) {
    store.removeItem(SYSTEM_TITLE_KEY);
  } else {
    store.setItem(SYSTEM_TITLE_KEY, trimmed);
  }
  broadcastChange();
}

/* --------------------------- 事件廣播 --------------------------- */

function broadcastChange(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(SITE_SETTINGS_EVENT));
    // 同步觸發 storage 事件以便其他分頁感知 (setItem 不會自動跨分頁觸發 storage)
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: SITE_PUBLIC_ENABLED_KEY,
        newValue: safeStorage()?.getItem(SITE_PUBLIC_ENABLED_KEY) ?? null,
      })
    );
  } catch {
    /* ignore */
  }
}