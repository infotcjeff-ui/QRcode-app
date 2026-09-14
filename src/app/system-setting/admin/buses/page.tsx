import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase-server";
import type { Bus } from "@/lib/types";
import { BusesManagementClient } from "@/components/admin/buses-management-client";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "校巴資料管理 · 系統設定" };

async function loadBuses(): Promise<Bus[]> {
  if (!isSupabaseAdminConfigured()) return [];
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from("buses")
      .select("id, plate_number, route_name, capacity")
      .order("route_name", { ascending: true });
    return (data as Bus[] | null) ?? [];
  } catch {
    return [];
  }
}

export default async function BusesManagementPage() {
  const buses = await loadBuses();
  return (
    <main className="flex w-full flex-col bg-slate-50">
      <PageHeader title="校巴資料管理" href="/system-setting" />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-28 pt-5 sm:px-6 lg:px-8">
        <BusesManagementClient initialBuses={buses} />
      </div>
    </main>
  );
}
