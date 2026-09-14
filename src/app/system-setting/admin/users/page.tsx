import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase-server";
import type { Bus, User } from "@/lib/types";
import { UsersManagementClient } from "@/components/admin/users-management-client";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "人員帳號 · 系統設定" };

async function loadData(): Promise<{ users: User[]; buses: Bus[] }> {
  if (!isSupabaseAdminConfigured()) return { users: [], buses: [] };
  const supabase = getSupabaseAdmin();
  if (!supabase) return { users: [], buses: [] };
  try {
    const [usersRes, busesRes] = await Promise.all([
      supabase
        .from("users")
        .select("id, name, phone, role, assigned_bus_id")
        .order("name", { ascending: true }),
      supabase.from("buses").select("id, plate_number, route_name, capacity"),
    ]);
    return {
      users: (usersRes.data as User[] | null) ?? [],
      buses: (busesRes.data as Bus[] | null) ?? [],
    };
  } catch {
    return { users: [], buses: [] };
  }
}

export default async function UsersManagementPage() {
  const { users, buses } = await loadData();
  return (
    <main className="flex w-full flex-col bg-slate-50">
      <PageHeader title="人員帳號" href="/system-setting" />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-28 pt-5 sm:px-6 lg:px-8">
        <UsersManagementClient initialUsers={users} buses={buses} />
      </div>
    </main>
  );
}
