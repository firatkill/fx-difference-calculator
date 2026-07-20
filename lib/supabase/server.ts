import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";

/**
 * Server Component / Route Handler içinde kullanılan Supabase istemcisi.
 * Server Component'ten çağrıldığında çerez yazımı mümkün olmayabilir;
 * bu durumda sessizce yok sayılır çünkü middleware oturumu zaten tazeler.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component'ten çağrıldı; middleware oturumu tazeliyor.
        }
      },
    },
  });
}
