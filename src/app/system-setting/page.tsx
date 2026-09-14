"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  Bus,
  ChartPie,
  ChevronRight,
  Cog,
  Database,
  Globe,
  GraduationCap,
  QrCode,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsGroup, SettingsItem } from "@/components/ui/settings-group";
import {
  SITE_PUBLIC_ENABLED_KEY,
  SITE_PASSWORD_OVERRIDE_KEY,
} from "@/lib/site-settings";
import { getAuthUser, ROLE_LABEL, type AuthUser } from "@/lib/auth";
import i18n from "@/lib/i18n";

type MenuEntry = {
  href: string;
  titleKey: string;
  subtitleKey: string;
  icon: React.ReactNode;
  groupKey: string;
};

const ENTRIES: MenuEntry[] = [
  {
    href: "/system-setting/admin/buses",
    titleKey: "system.busData",
    subtitleKey: "system.busDataDesc",
    icon: <Bus className="h-4 w-4" />,
    groupKey: "system.busManagement",
  },
  {
    href: "/system-setting/admin/qr-codes",
    titleKey: "system.qrCodes",
    subtitleKey: "system.qrCodesDesc",
    icon: <QrCode className="h-4 w-4" />,
    groupKey: "system.busManagement",
  },
  {
    href: "/system-setting/admin/students",
    titleKey: "system.studentMgmt",
    subtitleKey: "system.studentMgmtDesc",
    icon: <GraduationCap className="h-4 w-4" />,
    groupKey: "system.studentManagement",
  },
  {
    href: "/student",
    titleKey: "system.parentTracking",
    subtitleKey: "system.parentTrackingDesc",
    icon: <Users className="h-4 w-4" />,
    groupKey: "system.studentManagement",
  },
  {
    href: "/system-setting/admin/statistics",
    titleKey: "system.statistics",
    subtitleKey: "system.statisticsDesc",
    icon: <BarChart3 className="h-4 w-4" />,
    groupKey: "system.reportAnalysis",
  },
  {
    href: "/system-setting/admin",
    titleKey: "system.adminConsole",
    subtitleKey: "system.adminConsoleDesc",
    icon: <ChartPie className="h-4 w-4" />,
    groupKey: "system.reportAnalysis",
  },
  {
    href: "/system-setting/admin/site-settings",
    titleKey: "system.siteSettings",
    subtitleKey: "system.siteSettingsDesc",
    icon: <Globe className="h-4 w-4" />,
    groupKey: "system.siteAndUsers",
  },
  {
    href: "/system-setting/admin/users",
    titleKey: "system.adminUsers",
    subtitleKey: "system.adminUsersDesc",
    icon: <UserCog className="h-4 w-4" />,
    groupKey: "system.siteAndUsers",
  },
];

const GROUPS_ORDER: MenuEntry["groupKey"][] = [
  "system.busManagement",
  "system.studentManagement",
  "system.reportAnalysis",
  "system.siteAndUsers",
];

export default function SystemSettingPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sitePublic, setSitePublic] = useState<boolean>(false);
  const [hasCustomPassword, setHasCustomPassword] = useState<boolean>(false);
  const [ready, setReady] = useState(false);
  const [langKey, setLangKey] = useState(0);

  useEffect(() => {
    const u = getAuthUser();
    if (!u || u.role !== "admin") {
      router.replace("/lock");
      return;
    }
    setUser(u);

    try {
      setSitePublic(window.localStorage.getItem(SITE_PUBLIC_ENABLED_KEY) === "1");
      setHasCustomPassword(!!window.localStorage.getItem(SITE_PASSWORD_OVERRIDE_KEY));
    } catch {
      /* ignore */
    }

    const sync = () => {
      try {
        setSitePublic(window.localStorage.getItem(SITE_PUBLIC_ENABLED_KEY) === "1");
        setHasCustomPassword(!!window.localStorage.getItem(SITE_PASSWORD_OVERRIDE_KEY));
      } catch {
        /* ignore */
      }
    };

    window.addEventListener("bus-site-settings-changed", sync);
    window.addEventListener("storage", sync);
    setReady(true);

    return () => {
      window.removeEventListener("bus-site-settings-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, [router]);

  // 監聽 i18n 語言變化（reload 前短暫渲染新語言）
  useEffect(() => {
    const handler = () => setLangKey((k) => k + 1);
    i18n.on("languageChanged", handler);
    return () => {
      i18n.off("languageChanged", handler);
    };
  }, []);

  if (!ready || !user) {
    return (
      <main className="flex w-full items-center justify-center bg-slate-50 text-slate-500">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      </main>
    );
  }

  const byGroup = GROUPS_ORDER.map((g) => ({
    groupKey: g,
    items: ENTRIES.filter((e) => e.groupKey === g),
  }));

  return (
    <main className="relative flex w-full flex-col bg-slate-50" key={langKey}>
      {/* Header 全幅 */}
      <PageHeader title={t("system.title")} onBack={() => router.push("/profile")} />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-5 pb-28 pt-5">
          {/* 站台狀態摘要 */}
          <SettingsGroup
            title={t("system.siteStatus")}
            description={t("system.siteStatusDesc")}
          >
            <SettingsItem
              icon={<Globe className="h-4 w-4" />}
              title={t("system.sitePublicMode")}
              subtitle={sitePublic ? t("system.sitePublicOn") : t("system.sitePublicOff")}
              trailing={
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-[11px] font-medium " +
                    (sitePublic
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600")
                  }
                >
                  {sitePublic ? "ON" : "OFF"}
                </span>
              }
              href="/system-setting/admin/site-settings"
            />
            <SettingsItem
              icon={<Database className="h-4 w-4" />}
              title={t("system.sitePassword")}
              subtitle={
                hasCustomPassword
                  ? t("system.sitePasswordCustom")
                  : t("system.sitePasswordDefault")
              }
              trailing={
                <span className="flex items-center gap-1 text-[12px] text-slate-500">
                  {hasCustomPassword
                    ? t("system.sitePasswordCustomLabel")
                    : t("system.sitePasswordDefaultLabel")}
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </span>
              }
              href="/system-setting/admin/site-settings"
            />
          </SettingsGroup>

          {/* 功能分組 */}
          {byGroup.map(({ groupKey, items }) => (
            <SettingsGroup key={groupKey} title={t(groupKey)}>
              {items.map((it) => (
                <SettingsItem
                  key={it.href}
                  icon={it.icon}
                  title={t(it.titleKey)}
                  subtitle={t(it.subtitleKey)}
                  href={it.href}
                />
              ))}
            </SettingsGroup>
          ))}

          <p className="mt-2 text-center text-[11px] text-slate-400">
            {t("system.footer")}
          </p>
        </div>
      </div>
    </main>
  );
}
