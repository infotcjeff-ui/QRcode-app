import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase-server";
import type { Bus } from "@/lib/types";
import { BusesManagementClient } from "@/components/admin/buses-management-client";
import { BackButton } from "@/components/ui/back-button";
import { Bus as BusIcon } from "lucide-react";

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
    <main className="flex w-full flex-col gap-6 overflow-auto px-4 py-6 sm:px-6 lg:px-8 scrollbar-inset">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BusIcon className="h-6 w-6" />
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">校巴資料管理</h1>
        </div>
        <BackButton parent="/system-setting/admin" label="返回管理員控制台" />
      </header>

      <BusesManagementClient initialBuses={buses} />
    </main>
  );
}
