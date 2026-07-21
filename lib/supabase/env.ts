/**
 * Supabase ortam değişkenleri. Anahtar isimleri Supabase'in yeni
 * isimlendirmesini kullanır (ANON_KEY/SERVICE_ROLE_KEY değil).
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Ortam değişkeni eksik: ${name} (.env dosyasına bakın)`);
  }
  return value;
}

export function getSupabaseUrl(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

export function getSupabasePublishableKey(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

/** Yalnızca sunucu tarafında (seed/admin işlemleri) kullanılır, client'a asla gitmez */
export function getSupabaseSecretKey(): string {
  return required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
}

/**
 * Uygulamanın mutlak kök adresi (Server Action'lar gelen isteğin origin'ine
 * middleware/Server Component'ler gibi doğrudan erişemez, bu yüzden
 * redirectTo URL'leri için bu değişken gerekir).
 */
export function getSiteUrl(): string {
  return required("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL);
}
