"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, setRememberMe } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";
import {
  clearThrottle,
  recordFailedAttempt,
  remainingLockSeconds,
} from "@/lib/login-throttle";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockSeconds, setLockSeconds] = useState(0);
  const [emailChanged, setEmailChanged] = useState(false);

  useEffect(() => {
    setLockSeconds(remainingLockSeconds());
    const interval = setInterval(() => {
      setLockSeconds(remainingLockSeconds());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (searchParams.get("emailChanged") === "1") {
      setEmailChanged(true);
      router.replace("/sign-in", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lockSeconds > 0) return;
    setError(null);
    setLoading(true);

    setRememberMe(remember);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      recordFailedAttempt();
      setLockSeconds(remainingLockSeconds());
      setError(translateAuthError(signInError.message));
      setLoading(false);
      return;
    }

    clearThrottle();

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel) {
      router.push(`/mfa-challenge?next=${encodeURIComponent(next)}`);
      return;
    }

    router.push(next);
    router.refresh();
  }

  const locked = lockSeconds > 0;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Döviz Kuru Farkı</h1>
        <p className="mt-1 text-sm text-slate-500">Devam etmek için giriş yapın.</p>

        {emailChanged && (
          <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            E-postanız güncellendi. Yeni e-postanızla giriş yapın.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              E-posta
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Şifre
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Beni hatırla
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {locked && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Çok fazla başarısız deneme. {lockSeconds} saniye sonra tekrar
              deneyin.
            </p>
          )}

          <button
            type="submit"
            disabled={loading || locked}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Giriş yapılıyor…" : "Giriş yap"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
