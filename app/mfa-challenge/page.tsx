"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";
import MfaEnrollFields from "@/components/MfaEnrollFields";
import type { Factor } from "@supabase/supabase-js";

interface VerifiedFactor {
  id: string;
  name: string;
}

function MfaChallengeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [factors, setFactors] = useState<VerifiedFactor[] | undefined>(
    undefined,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: userData }, { data: factorData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.mfa.listFactors(),
      ]);
      setIsAdmin(userData.user?.app_metadata?.role === "super-admin");
      const verified = (factorData?.all ?? [])
        .filter((f: Factor) => f.status === "verified")
        .map((f: Factor) => ({ id: f.id, name: f.friendly_name || "Authenticator" }));
      setFactors(verified);
      setSelectedId(verified[0]?.id ?? null);
    }
    load();
  }, []);

  function handleEnrolled() {
    router.push(next);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || code.length !== 6) return;
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: selectedId,
      code,
    });

    if (verifyError) {
      setLoading(false);
      setError(translateAuthError(verifyError.message));
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-center text-lg tracking-widest focus:border-blue-500 focus:outline-none";

  // Sıfır faktörlü admin: zorunlu kurulum (iptal edilemez, "Vazgeç" yok)
  if (factors !== undefined && factors.length === 0 && isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            Zorunlu MFA Kurulumu
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Yönetici hesapları için iki adımlı doğrulama zorunludur. Devam
            etmeden önce kurulumu tamamlayın.
          </p>
          <div className="mt-6">
            <MfaEnrollFields onEnrolled={handleEnrolled} />
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-4 w-full text-center text-sm text-slate-500 hover:underline"
          >
            Çıkış yap
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">
          İki Adımlı Doğrulama
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Authenticator uygulamanızdaki 6 haneli kodu girin.
        </p>

        {factors === undefined && (
          <p className="mt-6 text-sm text-slate-400">Yükleniyor…</p>
        )}

        {factors && factors.length === 0 && (
          <p className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Doğrulanmış bir MFA yöntemi bulunamadı. Lütfen tekrar giriş yapın.
          </p>
        )}

        {factors && factors.length > 0 && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {factors.length > 1 && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Kullanılacak authenticator
                </label>
                <select
                  value={selectedId ?? ""}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {factors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
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

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Doğrulanıyor…" : "Doğrula"}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-4 w-full text-center text-sm text-slate-500 hover:underline"
        >
          Çıkış yap
        </button>
      </div>
    </main>
  );
}

export default function MfaChallengePage() {
  return (
    <Suspense fallback={null}>
      <MfaChallengeForm />
    </Suspense>
  );
}
