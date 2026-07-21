import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Her ayrıcalıklı Server Action/sayfa veri çekiminin EN BAŞINDA çağrılır.
 * Middleware sayfa seviyesinde koruma sağlar, ama Server Action'lar
 * doğrudan POST edilebilen uç noktalardır — yetki kontrolünü yalnızca
 * middleware'e bırakmak tek katmanlı, kırılgan bir tasarımdır. Bu yüzden
 * her ayrıcalıklı işlem kendi içinde de doğrular (savunma derinliği).
 */
export async function requireAdmin(): Promise<{ id: string; email: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "super-admin") {
    throw new Error("Bu işlem için yönetici yetkisi gerekli.");
  }
  return { id: user.id, email: user.email ?? "" };
}
