"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";

/**
 * Davet ve şifre sıfırlama e-postalarının ortak varış sayfası. Kullanıcı
 * buraya bir imzalı bağlantıyla gelir (hash-fragment token — istemci
 * bilerek implicit akışta, bkz. lib/supabase/client.ts) — tarayıcı
 * istemcisi (detectSessionInUrl açık) sayfa yüklenirken bunu otomatik
 * işleyip oturumu kurar; burada elle bir kod değişimi yapmaya gerek yoktur.
 *
 * Eski şifre adımı YOK: imzalı bağlantıyla gelmiş olmak zaten
 * yeniden-kimlik-doğrulamadır.
 */
export default function SetPasswordScreen() {
  const router = useRouter();
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">(
    "checking",
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      setReady(data.user ? "ok" : "invalid");
    }
    check();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalı.");
      return;
    }
    if (password !== confirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    setSaving(false);

    if (updateError) {
      setError(translateAuthError(updateError.message));
      return;
    }
    router.push("/");
    router.refresh();
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Şifre Belirle</h1>

        {ready === "checking" && (
          <p className="mt-4 text-sm text-slate-500">Bağlantı doğrulanıyor…</p>
        )}

        {ready === "invalid" && (
          <>
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Bağlantı geçersiz veya süresi dolmuş. Lütfen tekrar bir bağlantı
              isteyin.
            </p>
            <a
              href="/sign-in"
              className="mt-4 block text-center text-sm text-blue-600 hover:underline"
            >
              Giriş sayfasına dön
            </a>
          </>
        )}

        {ready === "ok" && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <p className="text-sm text-slate-500">
              Devam etmek için yeni bir şifre belirleyin.
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Yeni şifre
              </label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Yeni şifre (tekrar)
              </label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Kaydediliyor…" : "Şifreyi Kaydet ve Devam Et"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
