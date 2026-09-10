import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;
let cachedConfigured = false;

export function isSupabaseAdminConfigured(): boolean {
  if (cachedConfigured) return cachedClient !== null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    cachedConfigured = true;
    return false;
  }

  try {
    cachedClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    cachedConfigured = true;
    return true;
  } catch {
    cachedConfigured = true;
    return false;
  }
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  isSupabaseAdminConfigured();
  return cachedClient;
}
