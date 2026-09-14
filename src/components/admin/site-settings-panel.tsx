"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Globe, KeyRound, Loader2, Lock, Power, Save, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-context";
import { cn } from "@/lib/utils";
import {
  SITE_SETTINGS_EVENT,
  getSitePublicEnabled,
  setSitePublicEnabled,
  setSitePasswordOverride,
} from "@/lib/site-settings";
import { getEffectiveSitePassword } from "@/lib/auth";

/**
 * 管理員控制台 — 站台設定 (站台公開狀態管理)。
 *  - 站台公開狀態 ON：需要輸入站台密碼才能進入 login page
 *  - 站台公開狀態 OFF：跳過鎖定頁，直接進入 login page
 *  - 站台密碼變更：覆寫 localStorage 中的站台密碼，立即生效。
 */
export function SiteSettingsPanel() {
  const { toast } = useToast();

  const [enabled, setEnabled] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    setEnabled(getSitePublicEnabled());
    setHydrated(true);
    const onChange = () => {
      setEnabled(getSitePublicEnabled());
    };
    window.addEventListener(SITE_SETTINGS_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(SITE_SETTINGS_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  function handleToggle() {
    if (toggling) return;
    const next = !enabled;
    setToggling(true);
    try {
      setSitePublicEnabled(next);
      setEnabled(next);
      toast({
        title: next ? "🔐 站台已啟用密碼保護" : "🌐 站台已關閉密碼保護",
        description: next
          ? "訪客需輸入站台密碼才能進入登入頁面。"
          : "站台密碼頁已停用，訪客可直接進入登入頁面。",
        duration: 3500,
      });
    } catch (err) {
      toast({
        title: "切換失敗",
        description: err instanceof Error ? err.message : "無法更新站台狀態。",
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setToggling(false);
    }
  }

  function validatePwd(): string | null {
    if (!newPwd) return "請輸入新站台密碼";
    if (newPwd.length < 4) return "新密碼至少 4 個字元";
    if (newPwd.length > 64) return "新密碼不可超過 64 個字元";
    if (newPwd !== confirmPwd) return "兩次輸入的新密碼不一致";
    if (newPwd === currentPwd) return "新密碼與目前密碼相同，無需變更";
    return null;
  }

  async function handleSavePwd(e: React.FormEvent) {
    e.preventDefault();
    if (savingPwd) return;
    const err = validatePwd();
    if (err) {
      toast({ title: "資料不完整", description: err, variant: "destructive", duration: 4000 });
      return;
    }
    setSavingPwd(true);
    try {
      setSitePasswordOverride(newPwd.trim());
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
      toast({
        title: "✅ 已更新站台密碼",
        description: "新密碼將立即套用於此裝置的鎖定頁驗證。",
        duration: 3500,
      });
    } catch (e) {
      toast({
        title: "更新失敗",
        description: e instanceof Error ? e.message : "無法寫入站台密碼。",
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setSavingPwd(false);
    }
  }

  function handleResetPwd() {
    if (savingPwd) return;
    if (!confirm("確定要清除站台密碼覆寫，恢復為預設密碼嗎？")) return;
    setSitePasswordOverride(null);
    setCurrentPwd("");
    setNewPwd("");
    setConfirmPwd("");
    toast({
      title: "已重置站台密碼",
      description: "站台密碼已恢復為預設值 (或 NEXT_PUBLIC_SITE_PASSWORD)。",
      duration: 3500,
    });
  }

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Globe className="h-5 w-5" /> 站台設定
        </CardTitle>
        <CardDescription>
          控制整個網站的存取權限。啟用保護後，訪客需先輸入站台密碼才能進入登入頁面；
          停用則可直接進入登入流程。站台密碼以 .env.local (NEXT_PUBLIC_SITE_PASSWORD)
          為預設值，可在此臨時覆寫。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 站台公開狀態 */}
        <section className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                {enabled ? (
                  <Lock className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Globe className="h-4 w-4 text-slate-500" />
                )}
                站台公開狀態
              </h3>
              <p className="text-xs text-slate-500">
                {enabled
                  ? "站台密碼保護已啟用，訪客需輸入站台密碼才能進入登入頁面。"
                  : "站台密碼保護已停用，訪客可直接進入登入頁面。"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                  enabled
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    enabled ? "bg-emerald-500" : "bg-slate-400"
                  )}
                />
                {enabled ? "密碼保護中" : "已停用"}
              </span>
              <Button
                type="button"
                size="sm"
                variant={enabled ? "outline" : "default"}
                onClick={handleToggle}
                disabled={toggling || !hydrated}
                className={cn(
                  "min-w-[88px]",
                  !enabled &&
                    "bg-emerald-600 text-white hover:bg-emerald-500"
                )}
              >
                {toggling ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : enabled ? (
                  <Power className="mr-1 h-3 w-3" />
                ) : (
                  <Lock className="mr-1 h-3 w-3" />
                )}
                {enabled ? "停用保護" : "啟用保護"}
              </Button>
            </div>
          </div>
        </section>

        <div className="h-px w-full bg-slate-100" />

        {/* 站台密碼變更 */}
        <section className="space-y-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <KeyRound className="h-4 w-4 text-slate-600" />
              站台密碼設定
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              此密碼用於站台公開狀態「啟用保護」時的驗證。
              預設密碼為 <code className="rounded bg-slate-100 px-1">bus2026</code>
              （亦即 <code>NEXT_PUBLIC_SITE_PASSWORD</code>）；輸入新密碼即可覆寫。
            </p>
          </div>

          <form onSubmit={handleSavePwd} className="space-y-3">
            <Field label="目前密碼 (用於驗證身份)">
              <Input
                type="password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                placeholder="請輸入目前的站台密碼"
                autoComplete="current-password"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="新站台密碼 *">
                <div className="relative">
                  <Input
                    type={showNew ? "text" : "password"}
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="至少 4 個字元"
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700"
                    aria-label={showNew ? "隱藏密碼" : "顯示密碼"}
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              <Field label="確認新站台密碼 *">
                <Input
                  type={showNew ? "text" : "password"}
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  placeholder="再次輸入新站台密碼"
                  autoComplete="new-password"
                />
              </Field>
            </div>

            {currentPwd && currentPwd !== getEffectiveSitePassword() ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>目前密碼不正確，仍可儲存，但建議先確認再變更。</span>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={savingPwd} size="sm">
                {savingPwd ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Save className="mr-1 h-3 w-3" />
                )}
                儲存新站台密碼
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetPwd}
                disabled={savingPwd}
              >
                恢復預設密碼
              </Button>
              <span className="ml-auto text-[11px] text-slate-400">
                環境變數：<code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_SITE_PASSWORD</code>
              </span>
            </div>
          </form>
        </section>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}