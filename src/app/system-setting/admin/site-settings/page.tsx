import { PageHeader } from "@/components/ui/page-header";
import { SiteSettingsPanel } from "@/components/admin/site-settings-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "站台設定 · 系統設定" };

export default function AdminSiteSettingsPage() {
  return (
    <main className="flex w-full flex-col bg-slate-50">
      <PageHeader title="站台設定" href="/system-setting" />

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pb-28 pt-5 sm:px-6">
        <SiteSettingsPanel />

        <footer className="text-center text-xs text-slate-400">
          © School Bus Check-in System · Realtime Supabase Subscriptions enabled
        </footer>
      </div>
    </main>
  );
}
