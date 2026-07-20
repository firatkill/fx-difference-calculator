"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import MfaEnrollModal from "@/components/MfaEnrollModal";
import type { Factor } from "@supabase/supabase-js";

interface VerifiedFactor {
  id: string;
  friendlyName?: string;
}

export default function MfaSection() {
  const [factor, setFactor] = useState<VerifiedFactor | null | undefined>(
    undefined,
  );
  const [showEnroll, setShowEnroll] = useState(false);
  const [removing, setRemoving] = useState(false);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    const verified =
      data?.all.find((f: Factor) => f.status === "verified") ?? null;
    setFactor(
      verified
        ? { id: verified.id, friendlyName: verified.friendly_name }
        : null,
    );
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleRemove() {
    if (!factor) return;
    if (!confirm("MFA'yı kaldırmak istediğinize emin misiniz?")) return;
    setRemoving(true);
    const supabase = createClient();
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
    setRemoving(false);
    await reload();
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-800">
        İki Adımlı Doğrulama (MFA)
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Authenticator uygulaması ile girişlerinize ekstra bir güvenlik
        katmanı ekleyin.
      </p>

      <div className="mt-4">
        {factor === undefined && (
          <p className="text-sm text-slate-400">Yükleniyor…</p>
        )}
        {factor === null && (
          <button
            type="button"
            onClick={() => setShowEnroll(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            MFA'yı Etkinleştir
          </button>
        )}
        {factor && (
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
              MFA Aktif ✓
            </span>
            <button
              type="button"
              disabled={removing}
              onClick={handleRemove}
              className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              {removing ? "Kaldırılıyor…" : "Kaldır"}
            </button>
          </div>
        )}
      </div>

      {showEnroll && (
        <MfaEnrollModal
          onCancel={() => setShowEnroll(false)}
          onEnrolled={() => {
            setShowEnroll(false);
            reload();
          }}
        />
      )}
    </section>
  );
}
