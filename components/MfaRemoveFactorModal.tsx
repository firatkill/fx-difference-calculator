"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";

interface Props {
  factorId: string;
  factorName: string;
  onRemoved: () => void;
  onCancel: () => void;
}

/**
 * Bir authenticator'ı kaldırmadan önce, o cihazdaki güncel 6 haneli kodu
 * ister — yalnızca oturuma (ör. çalınmış bir tarayıcı oturumu) sahip
 * olmak, kullanıcının fiziksel cihaza da sahip olduğunu kanıtlamaz.
 */
export default function MfaRemoveFactorModal({
  factorId,
  factorName,
  onRemoved,
  onCancel,
}: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    if (verifyError) {
      setLoading(false);
      setError(translateAuthError(verifyError.message));
      return;
    }

    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId,
    });
    setLoading(false);
    if (unenrollError) {
      setError(translateAuthError(unenrollError.message));
      return;
    }
    onRemoved();
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-widest focus:border-blue-500 focus:outline-none";

  return (
    <Modal title={`"${factorName}" kaldırılsın mı?`} onClose={onCancel}>
      <div className="mt-4 space-y-4">
        <p className="text-sm text-slate-600">
          Kaldırmayı onaylamak için bu authenticator'daki güncel 6 haneli
          kodu girin.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            pattern="[0-9]*"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            className={inputClass}
            autoFocus
            required
          />

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
            >
              {loading ? "Kaldırılıyor…" : "Kaldır"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
