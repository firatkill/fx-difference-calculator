import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl, getSupabaseSecretKey } from "@/lib/supabase/env";

/**
 * SERVICE-ROLE Supabase istemcisi. RLS'i tamamen atlar. Yalnızca sunucu
 * tarafında (Server Component / Server Action / Route Handler) kullanılır.
 * ASLA "use client" bir dosyadan import EDİLMEMELİ — service-role anahtarı
 * tarayıcıya asla gönderilmemelidir. Kullanıcı oturumu/çerezi yok, bu yüzden
 * @supabase/ssr değil, doğrudan @supabase/supabase-js kullanılır.
 */
export function createAdminClient() {
  return createClient(getSupabaseUrl(), getSupabaseSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
