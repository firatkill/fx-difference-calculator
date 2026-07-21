"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { getSiteUrl } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";

function translateAdminError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already been registered") || m.includes("already registered")) {
    return "Bu e-posta adresiyle zaten bir kullanıcı kayıtlı.";
  }
  if (m.includes("invalid") && m.includes("email")) {
    return "Geçersiz e-posta adresi.";
  }
  return message;
}

export async function inviteUser(email: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  // NOT: inviteUserByEmail PKCE desteklemez (davet eden ve kabul eden
  // tarayıcı farklı olabildiğinden) — bu yüzden davet linki her zaman
  // hash-fragment (implicit) token üretir. redirectTo doğrudan
  // /set-password'e verilir; ara bir callback route'u GEREKMEZ, çünkü
  // hash fragment sunucuya hiç ulaşmaz (bir sunucu yönlendirmesi onu
  // kaybeder) — tarayıcı istemcisi (lib/supabase/client.ts,
  // detectSessionInUrl varsayılan açık) sayfa yüklenince otomatik işler.
  const { error } = await admin.auth.admin.inviteUserByEmail(email.trim(), {
    redirectTo: `${getSiteUrl()}/set-password`,
  });
  if (error) throw new Error(translateAdminError(error.message));
  revalidatePath("/admin");
}

export async function deleteUserPermanently(userId: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  // customers/invoices/payments FK'leri "on delete cascade" — ekstra
  // temizlik kodu gerekmez (bkz. supabase/migrations/0001_init.sql).
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error("Kullanıcı silinemedi: " + error.message);
  revalidatePath("/admin");
}

export async function setUserBanned(
  userId: string,
  banned: boolean,
): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: banned ? "876000h" : "none", // ~100 yıl / kaldır
  });
  if (error) throw new Error("Durum güncellenemedi: " + error.message);
  revalidatePath("/admin");
}

export interface AdminUserSummary {
  id: string;
  email: string;
  createdAt: string;
  bannedUntil: string | null;
  mfaEnabled: boolean;
  /** Satır bazında kendi kendini silme/banlama düğmelerini devre dışı bırakmak için */
  isSelf: boolean;
}

export async function listAllUsers(): Promise<AdminUserSummary[]> {
  const { id: currentAdminId } = await requireAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw new Error("Kullanıcı listesi alınamadı: " + error.message);

  // Süper admin hesaplarını listede gösterme — bu panel sadece admin'in
  // davet ettiği normal kullanıcılar içindir.
  const regularUsers = data.users.filter(
    (u) => u.app_metadata?.role !== "super-admin",
  );

  return Promise.all(
    regularUsers.map(async (u): Promise<AdminUserSummary> => {
      const { data: factorData } = await admin.auth.admin.mfa.listFactors({
        userId: u.id,
      });
      const mfaEnabled =
        factorData?.factors.some((f) => f.status === "verified") ?? false;
      return {
        id: u.id,
        email: u.email ?? "",
        createdAt: u.created_at,
        bannedUntil:
          u.banned_until && new Date(u.banned_until) > new Date()
            ? u.banned_until
            : null,
        mfaEnabled,
        isSelf: u.id === currentAdminId,
      };
    }),
  );
}
