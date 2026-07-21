"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTr } from "@/lib/dates";
import {
  deleteUserPermanently,
  setUserBanned,
  type AdminUserSummary,
} from "@/lib/admin/actions";
import InviteUserModal from "@/components/InviteUserModal";

export default function AdminUserListScreen({
  initialUsers,
}: {
  initialUsers: AdminUserSummary[];
}) {
  const router = useRouter();
  const [showInvite, setShowInvite] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleDelete(u: AdminUserSummary) {
    if (
      !confirm(
        `"${u.email}" kalıcı olarak silinsin mi? Bu kullanıcının TÜM müşteri/fatura/ödeme verisi de kalıcı olarak silinir. Bu işlem geri alınamaz.`,
      )
    ) {
      return;
    }
    setBusyId(u.id);
    try {
      await deleteUserPermanently(u.id);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleBan(u: AdminUserSummary) {
    const willBan = !u.bannedUntil;
    if (willBan && !confirm(`"${u.email}" deaktive edilsin mi?`)) return;
    setBusyId(u.id);
    try {
      await setUserBanned(u.id, willBan);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Kullanıcılar</h2>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Kullanıcı Ekle
        </button>
      </div>

      {initialUsers.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">Henüz kullanıcı yok.</p>
      )}

      <ul className="mt-4 space-y-2">
        {initialUsers.map((u) => {
          const banned = !!u.bannedUntil;
          const busy = busyId === u.id;
          return (
            <li
              key={u.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <button
                type="button"
                onClick={() => router.push(`/admin/users/${u.id}`)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-slate-900 hover:text-blue-700">
                    {u.email}
                  </span>
                  {u.mfaEnabled && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      MFA
                    </span>
                  )}
                  {banned && (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                      Deaktif
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  Oluşturulma: {formatDateTr(u.createdAt.slice(0, 10))}
                </div>
              </button>
              <button
                type="button"
                disabled={busy || u.isSelf}
                title={u.isSelf ? "Kendi hesabınızı deaktive edemezsiniz" : undefined}
                onClick={() => handleToggleBan(u)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                {banned ? "Aktifleştir" : "Deaktive Et"}
              </button>
              <button
                type="button"
                disabled={busy || u.isSelf}
                title={u.isSelf ? "Kendi hesabınızı silemezsiniz" : undefined}
                onClick={() => handleDelete(u)}
                className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
              >
                🗑️
              </button>
            </li>
          );
        })}
      </ul>

      {showInvite && (
        <InviteUserModal
          onCancel={() => setShowInvite(false)}
          onInvited={() => {
            setShowInvite(false);
            router.refresh();
          }}
        />
      )}
    </main>
  );
}
