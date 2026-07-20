"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";
import type { Factor } from "@supabase/supabase-js";

function MfaChallengeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [factorId, setFactorId] = useState<string | null | undefined>(
    undefined,
  );
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const result = await supabase.auth.mfa.listFactors();
      const verified = result.data?.all.find(
        (f: Factor) => f.status === "verified",
      );
      setFactorId(verified?.id ?? null);
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || code.length !== 6) return;
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">
          İki Adımlı Doğrulama
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Authenticator uygulamanızdaki 6 haneli kodu girin.
        </p>

        {factorId === undefined && (
          <p className="mt-6 text-sm text-slate-400">Yükleniyor…</p>
        )}

        {factorId === null && (
          <p className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Doğrulanmış bir MFA yöntemi bulunamadı. Lütfen tekrar giriş yapın.
          </p>
        )}

        {factorId && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
