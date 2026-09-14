"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { KeyRound, ShieldCheck, Smartphone, User } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsGroup, SettingsItem } from "@/components/ui/settings-group";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-context";
import { getAuthUser, setAuthUser, ROLE_LABEL, type AuthUser } from "@/lib/auth";

type LoadedUser = AuthUser | null;
const INITIAL: LoadedUser = null;

export default function AccountPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [user, setUser] = useState<LoadedUser>(INITIAL);
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  // 載入使用者資料
  useEffect(() => {
    const u = getAuthUser();
    if (!u) {
      router.replace("/lock");
      return;
    }
    setUser(u);
    setPhone(u.phone ?? "");
  }, [router]);

  const isPhoneChanged = phone !== (user?.phone ?? "");
  const canSave = isPhoneChanged && phone.trim().length > 0;

  function handleSavePhone() {
    if (!user || saving) return;
    setSaving(true);
    try {
      const updated: AuthUser = { ...user, phone: phone.trim() };
      setAuthUser(updated);
      setUser(updated);
      setPhoneTouched(false);
      toast({
        title: t("account.saved"),
        description: t("account.savedDesc"),
        duration: 2000,
      });
    } catch {
      toast({ title: t("account.saveFailed"), description: t("account.saveFailedDesc"), duration: 2500 });
    } finally {
      setSaving(false);
    }
  }

  if (user === INITIAL) {
    return (
      <main className="flex w-full items-center justify-center bg-slate-50 text-slate-500">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      </main>
    );
  }
  if (user === null) return null;

  return (
    <main className="relative flex w-full flex-col bg-slate-50">
      {/* Header 全幅 */}
      <PageHeader title={t("account.title")} onBack={() => router.push("/profile")} />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-5 px-5 pb-28 pt-5">
          {/* 基本資料 */}
          <SettingsGroup title={t("account.basicInfo")}>
            <SettingsItem
              icon={<User className="h-4 w-4" />}
              title={t("account.name")}
              trailing={<span className="text-[13px] text-slate-600">{user.name}</span>}
              hideChevron
            />
            <SettingsItem
              icon={<ShieldCheck className="h-4 w-4" />}
              title={t("account.role")}
              trailing={<span className="text-[13px] text-slate-600">{ROLE_LABEL[user.role]}</span>}
              hideChevron
            />
          </SettingsGroup>

          {/* 聯絡資料 — 可編輯電話 */}
          <SettingsGroup title={t("account.contactInfo")}>
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-slate-500" />
                <label htmlFor="phone" className="text-[13px] font-medium text-slate-700">
                  {t("account.phone")}
                </label>
              </div>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setPhoneTouched(true);
                }}
                placeholder={t("account.phonePlaceholder")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none transition-colors focus:border-slate-900"
              />
              {phoneTouched && !canSave && phone.trim().length === 0 ? (
                <p className="text-[12px] text-red-500">{t("account.phoneEmptyError")}</p>
              ) : null}
            </div>
            <div className="flex justify-end px-4 pb-4">
              <Button
                size="sm"
                disabled={!canSave}
                onClick={handleSavePhone}
                className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40"
              >
                {saving ? t("account.saving") : t("account.saveChanges")}
              </Button>
            </div>
          </SettingsGroup>

          {/* 安全性 */}
          <SettingsGroup title={t("account.security")}>
            <SettingsItem
              icon={<KeyRound className="h-4 w-4" />}
              title={t("account.changePassword")}
              subtitle={t("account.changePasswordDesc")}
              onClick={() =>
                toast({
                  title: t("account.changePasswordTitle"),
                  description: t("account.changePasswordMsg"),
                  duration: 3000,
                })
              }
            />
          </SettingsGroup>
        </div>
      </div>
    </main>
  );
}
