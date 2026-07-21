"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import MfaEnrollModal from "@/components/MfaEnrollModal";
import MfaRemoveFactorModal from "@/components/MfaRemoveFactorModal";
import type { Factor } from "@supabase/supabase-js";

interface VerifiedFactor {
  id: string;
  name: string;
}

export default function MfaSection() {
  const [factors, setFactors] = useState<VerifiedFactor[] | undefined>(
    undefined,
  );
  const [showEnroll, setShowEnroll] = useState(false);
  const [removingFactor, setRemovingFactor] = useState<VerifiedFactor | null>(
    null,
  );

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = (data?.all ?? [])
      .filter((f: Factor) => f.status === "verified")
      .map((f: Factor) => ({ id: f.id, name: f.friendly_name || "Authenticator" }));
    setFactors(verified);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-800">
        İki Adımlı Doğrulama (MFA)
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Authenticator uygulamaları ile girişlerinize ekstra bir güvenlik
        katmanı ekleyin. Birden fazla cihaz/uygulama ekleyebilirsiniz.
      </p>

      <div className="mt-4 space-y-2">
        {factors === undefined && (
          <p className="text-sm text-slate-400">Yükleniyor…</p>
        )}

        {factors && factors.length === 0 && (
          <p className="text-sm text-slate-500">
            Henüz bir authenticator eklenmedi.
          </p>
        )}

        {factors?.map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
          >
            <span className="text-sm font-medium text-slate-700">
              {f.name}
            </span>
            <button
              type="button"
              onClick={() => setRemovingFactor(f)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
            >
              Kaldır
            </button>
          </div>
        ))}

        {factors && (
          <button
            type="button"
            onClick={() => setShowEnroll(true)}
            className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Yeni Authenticator Ekle
          </button>
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

      {removingFactor && (
        <MfaRemoveFactorModal
          factorId={removingFactor.id}
          factorName={removingFactor.name}
          onCancel={() => setRemovingFactor(null)}
          onRemoved={() => {
            setRemovingFactor(null);
            reload();
          }}
        />
      )}
    </section>
  );
}
