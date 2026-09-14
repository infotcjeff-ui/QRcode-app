"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Database, Globe, LifeBuoy, LogOut, Settings as SettingsIcon, UserCog } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  ProfileHeaderCard,
  SettingsGroup,
  SettingsItem,
} from "@/components/ui/settings-group";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast-context";
import { setLanguage } from "@/components/i18n-provider";
import {
  clearAuthUser,
  clearSiteAccessCookie,
  ROLE_LABEL,
  type AuthUser,
} from "@/lib/auth";
import { LANG_LABELS, SUPPORTED_LANGS, type SupportedLang } from "@/lib/i18n";
import {
  DEFAULT_SYSTEM_TITLE,
  getSystemTitle,
  setSystemTitle,
  SYSTEM_TITLE_MAX_LENGTH,
} from "@/lib/site-settings";
import i18n from "@/lib/i18n";

type LoadedUser = AuthUser | null;

const INITIAL: LoadedUser = null;

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [user, setUser] = useState<LoadedUser>(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  // 聯絡支援 popup
  const [showDevPopup, setShowDevPopup] = useState(false);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 語言切換流程：picker → 確認
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showLangConfirm, setShowLangConfirm] = useState(false);
  const [pendingLang, setPendingLang] = useState<SupportedLang | null>(null);

  // 系統標題編輯流程
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [systemTitle, setSystemTitleState] = useState<string>(DEFAULT_SYSTEM_TITLE);

  // 當前語言標籤（從 i18n 取得，force re-render）
  const [langKey, setLangKey] = useState(0);
  const currentLang = (i18n.language ?? "zh-HK") as SupportedLang;
  const langLabel = LANG_LABELS[currentLang] ?? "繁體中文";

  useEffect(() => {
    const u = typeof window !== "undefined" ? readUser() : null;
    if (!u) {
      router.replace("/lock");
      return;
    }
    setUser(u);
    setSystemTitleState(getSystemTitle());
  }, [router]);

  // 監聽站台設定變更（即時同步系統標題顯示）
  useEffect(() => {
    const handler = () => setSystemTitleState(getSystemTitle());
    window.addEventListener("bus-site-settings-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("bus-site-settings-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  // 監聽 i18n 語言變化（reload 前短暫渲染新語言）
  useEffect(() => {
    const handler = () => setLangKey((k) => k + 1);
    i18n.on("languageChanged", handler);
    return () => {
      i18n.off("languageChanged", handler);
    };
  }, []);

  // 自動關閉 popup
  useEffect(() => {
    if (!showDevPopup) return;
    popupTimerRef.current = setTimeout(() => setShowDevPopup(false), 2500);
    return () => {
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    };
  }, [showDevPopup]);

  function readUser(): LoadedUser {
    try {
      const raw = window.localStorage.getItem("bus-auth-user");
      if (!raw) return null;
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  function handleLogout() {
    if (submitting) return;
    setSubmitting(true);
    clearAuthUser();
    clearSiteAccessCookie();
    toast({
      title: t("profile.loggedOut"),
      description: t("profile.loggedOutDesc"),
      duration: 3000,
    });
    setTimeout(() => {
      router.replace("/lock");
    }, 200);
  }

  function openTitleDialog() {
    setTitleDraft(getSystemTitle());
    setTitleError(null);
    setShowTitleDialog(true);
  }

  function handleSaveTitle() {
    const trimmed = titleDraft.trim();
    if (trimmed.length === 0) {
      setTitleError(t("profile.systemTitleEmptyError"));
      return;
    }
    const wasDefault = getSystemTitle() === DEFAULT_SYSTEM_TITLE;
    setSystemTitle(trimmed);
    setShowTitleDialog(false);
    if (wasDefault && trimmed === DEFAULT_SYSTEM_TITLE) {
      // 沒變更就不跳 toast
      return;
    }
    if (trimmed === DEFAULT_SYSTEM_TITLE) {
      toast({
        title: t("profile.systemTitleReset"),
        description: t("profile.systemTitleResetDesc"),
        duration: 2500,
      });
    } else {
      toast({
        title: t("profile.systemTitleUpdated"),
        description: t("profile.systemTitleUpdatedDesc"),
        duration: 2500,
      });
    }
  }

  function handleResetTitle() {
    setTitleDraft(DEFAULT_SYSTEM_TITLE);
    setTitleError(null);
  }

  if (user === INITIAL) {
    return (
      <main className="flex w-full items-center justify-center bg-slate-50 text-slate-500">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      </main>
    );
  }
  if (user === null) return null;

  const isAdmin = user.role === "admin";

  return (
    <main className="relative flex w-full flex-col bg-slate-50" key={langKey}>
      {/*
        Header 置於最外層，w-full 確保背景色延伸至 viewport 邊緣。
        內容區 max-w-md mx-auto 限制最大寬度，保持 20px 水平 padding。
      */}
      <PageHeader title={t("profile.title")} onBack={() => router.push("/")} />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-5 pb-28 pt-5">
          {/* 個人資料卡片 — 無編輯按鈕 */}
          <ProfileHeaderCard
            avatarText={user.name?.slice(0, 1) ?? "?"}
            name={user.name}
            subtitle={
              <>
                <span className="font-medium text-slate-700">{ROLE_LABEL[user.role]}</span>
                {user.phone ? <> · {user.phone}</> : null}
              </>
            }
          />

          {/* 偏好設定 */}
          <SettingsGroup
            title={t("profile.preferences")}
            description={t("profile.preferencesDesc")}
          >
            <SettingsItem
              icon={<Globe className="h-4 w-4" />}
              title={t("profile.language")}
              subtitle={t("profile.languageDesc")}
              trailing={langLabel}
              onClick={() => setShowLangPicker(true)}
            />
          </SettingsGroup>

          {/* 系統資料 — 站台顯示資訊 */}
          <SettingsGroup
            title={t("profile.systemData")}
            description={t("profile.systemDataDesc")}
          >
            <SettingsItem
              icon={<Database className="h-4 w-4" />}
              title={t("profile.systemTitle")}
              subtitle={t("profile.systemTitleDesc")}
              trailing={systemTitle}
              onClick={openTitleDialog}
            />
          </SettingsGroup>

          {/* 帳號 */}
          <SettingsGroup
            title={t("profile.account")}
            description={t("profile.accountDesc")}
          >
            {isAdmin ? (
              <SettingsItem
                icon={<SettingsIcon className="h-4 w-4" />}
                title={t("profile.systemSetting")}
                subtitle={t("profile.systemSettingDesc")}
                href="/system-setting"
              />
            ) : null}

            <SettingsItem
              icon={<UserCog className="h-4 w-4" />}
              title={t("profile.accountInfo")}
              subtitle={t("profile.accountInfoDesc")}
              href="/profile/account"
            />

            <SettingsItem
              icon={<LifeBuoy className="h-4 w-4" />}
              title={t("profile.contactSupport")}
              subtitle={t("profile.contactSupportDesc")}
              onClick={() => setShowDevPopup(true)}
            />

            <SettingsItem
              icon={<LogOut className="h-4 w-4" />}
              title={t("profile.logout")}
              subtitle={t("profile.logoutDesc")}
              destructive
              onClick={handleLogout}
              disabled={submitting}
            />
          </SettingsGroup>

          <p className="mt-2 text-center text-[11px] text-slate-400">
            {t("profile.version")}
          </p>
        </div>
      </div>

      {/* 語言選擇 picker */}
      <Dialog
        open={showLangPicker}
        onOpenChange={(open) => {
          setShowLangPicker(open);
          if (!open) setPendingLang(null);
        }}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle className="text-center">{t("profile.langPickerTitle")}</DialogTitle>
            <DialogDescription className="text-center">
              {t("profile.langPickerDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-1">
            {SUPPORTED_LANGS.map((code) => {
              const active = currentLang === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setPendingLang(code);
                    setShowLangPicker(false);
                    setShowLangConfirm(true);
                  }}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-[15px] transition-colors ${
                    active
                      ? "border-slate-900 bg-slate-50 text-slate-900"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="font-medium">{LANG_LABELS[code]}</span>
                  {active ? (
                    <span className="text-slate-900" aria-hidden>
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* 語言切換確認對話框 */}
      <Dialog open={showLangConfirm} onOpenChange={setShowLangConfirm}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle className="text-center">{t("profile.langConfirmTitle")}</DialogTitle>
            <DialogDescription className="text-center">
              {t("profile.langConfirmDesc", { lang: pendingLang ? LANG_LABELS[pendingLang] : "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 sm:justify-stretch sm:space-x-0">
            <button
              type="button"
              onClick={() => setShowLangConfirm(false)}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                setShowLangConfirm(false);
                if (pendingLang) {
                  setLanguage(pendingLang);
                }
              }}
              className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-slate-800"
            >
              確定
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 系統標題編輯對話框 */}
      <Dialog
        open={showTitleDialog}
        onOpenChange={(open) => {
          setShowTitleDialog(open);
          if (!open) setTitleError(null);
        }}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle className="text-center">
              {t("profile.systemTitleDialogTitle")}
            </DialogTitle>
            <DialogDescription className="text-center">
              {t("profile.systemTitleDialogDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 py-1">
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => {
                setTitleDraft(e.target.value);
                if (titleError) setTitleError(null);
              }}
              maxLength={SYSTEM_TITLE_MAX_LENGTH}
              placeholder={t("profile.systemTitlePlaceholder")}
              className={`w-full rounded-xl border bg-white px-4 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                titleError
                  ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                  : "border-slate-200 focus:border-slate-900 focus:ring-slate-200"
              }`}
            />
            <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
              <span className={titleError ? "text-red-500" : ""}>
                {titleError ?? t("profile.systemTitleDesc")}
              </span>
              <span>
                {titleDraft.trim().length}/{SYSTEM_TITLE_MAX_LENGTH}
              </span>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:justify-stretch sm:space-x-0">
            <button
              type="button"
              onClick={handleResetTitle}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              {t("profile.reset")}
            </button>
            <div className="flex w-full gap-2">
              <button
                type="button"
                onClick={() => setShowTitleDialog(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveTitle}
                className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-slate-800"
              >
                確定
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 功能開發中 popup — 置中，點擊背景或自動 2.5s 後關閉 */}
      <div
        aria-live="polite"
        onClick={() => setShowDevPopup(false)}
        className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
          showDevPopup ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className={`flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-8 py-6 shadow-2xl transition-transform duration-300 ${
            showDevPopup ? "pointer-events-auto scale-100" : "pointer-events-none scale-95"
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <span className="text-2xl">🔧</span>
          </div>
          <div className="text-center">
            <p className="text-[15px] font-semibold text-slate-900">
              {t("popup.devTitle")}
            </p>
            <p className="mt-1 text-[12px] text-slate-500">{t("popup.devDesc")}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
