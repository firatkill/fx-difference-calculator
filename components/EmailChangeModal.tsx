"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";
import { useOtpCooldown } from "@/lib/otp-cooldown";

interface Props {
  currentEmail: string;
  onCancel: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailChangeModal({ currentEmail, onCancel }: Props) {
  const router = useRouter();

  // Adım 1: eski e-posta doğrulama
  const [oldSent, setOldSent] = useState(false);
  const [oldVerified, setOldVerified] = useState(false);
  const [oldCode, setOldCode] = useState("");
  const oldCooldown = useOtpCooldown();

  // Adım 2: yeni e-posta
  const [newEmail, setNewEmail] = useState("");
  const [newSent, setNewSent] = useState(false);
  const [newCode, setNewCode] = useState("");
  const newCooldown = useOtpCooldown();

  const [loading, setLoading] = useState<
    "send-old" | "verify-old" | "send-new" | "verify-new" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

  async function handleSendOld() {
    setError(null);
    setLoading("send-old");
    const supabase = createClient();
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: currentEmail,
      options: { shouldCreateUser: false },
    });
    setLoading(null);
    if (sendError) {
      setError(translateAuthError(sendError.message));
      return;
    }
    setOldSent(true);
    oldCooldown.start();
  }

  async function handleVerifyOld(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading("verify-old");
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: currentEmail,
      token: oldCode,
      type: "email",
    });
    setLoading(null);
    if (verifyError) {
      setError(translateAuthError(verifyError.message));
      return;
    }
    setOldVerified(true);
  }

  const newEmailValid =
    EMAIL_RE.test(newEmail.trim()) &&
    newEmail.trim().toLowerCase() !== currentEmail.toLowerCase();

  async function handleSendNew() {
    if (!newEmailValid) return;
    setError(null);
    setLoading("send-new");
    const supabase = createClient();
    const { error: sendError } = await supabase.auth.updateUser({
      email: newEmail.trim(),
    });
    setLoading(null);
    if (sendError) {
      setError(translateAuthError(sendError.message));
      return;
    }
    setNewSent(true);
    newCooldown.start();
  }

  async function handleVerifyNew(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading("verify-new");
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: newEmail.trim(),
      token: newCode,
      type: "email_change",
    });
    if (verifyError) {
      setLoading(null);
      setError(translateAuthError(verifyError.message));
      return;
    }
    await supabase.auth.signOut();
    router.push("/sign-in?emailChanged=1");
    router.refresh();
  }

  return (
    <Modal title="E-postamı Değiştir" onClose={onCancel}>
      <div className="mt-4 space-y-6">
        {/* Blok 1: eski e-posta doğrulama */}
        <div
          className={`rounded-xl border p-4 ${
            oldVerified
              ? "border-green-200 bg-green-50"
              : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">
              Mevcut e-posta: <span className="font-semibold">{currentEmail}</span>
            </span>
            {oldVerified && (
              <span className="text-sm font-semibold text-green-700">
                ✓ Doğrulandı
              </span>
            )}
          </div>

          {!oldVerified && (
            <div className="mt-3 space-y-3">
              <button
                type="button"
                disabled={loading !== null || oldCooldown.seconds > 0}
                onClick={handleSendOld}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                {loading === "send-old"
                  ? "Gönderiliyor…"
                  : oldCooldown.seconds > 0
                    ? `Kod Gönder (${oldCooldown.seconds}s)`
                    : oldSent
                      ? "Kodu Tekrar Gönder"
                      : "Kod Gönder"}
              </button>

              {oldSent && (
                <form onSubmit={handleVerifyOld} className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    pattern="[0-9]*"
                    placeholder="6 haneli kod"
                    value={oldCode}
                    onChange={(e) =>
                      setOldCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    className={inputClass}
                    required
                  />
                  <button
                    type="submit"
                    disabled={loading !== null || oldCode.length !== 6}
                    className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                  >
                    {loading === "verify-old" ? "Doğrulanıyor…" : "Doğrula"}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Blok 2: yeni e-posta */}
        <fieldset
          disabled={!oldVerified}
          className={`rounded-xl border p-4 ${
            oldVerified
              ? "border-slate-200 bg-white"
              : "border-slate-100 bg-slate-50 opacity-60"
          }`}
        >
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Yeni e-posta
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className={inputClass}
              placeholder="yeni@ornek.com"
            />
            <button
              type="button"
              disabled={
                loading !== null || !newEmailValid || newCooldown.seconds > 0
              }
              onClick={handleSendNew}
              className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {loading === "send-new"
                ? "Gönderiliyor…"
                : newCooldown.seconds > 0
                  ? `Kod Gönder (${newCooldown.seconds}s)`
                  : newSent
                    ? "Tekrar Gönder"
                    : "Kod Gönder"}
            </button>
          </div>

          {newSent && (
            <form onSubmit={handleVerifyNew} className="mt-3 flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                pattern="[0-9]*"
                placeholder="6 haneli kod"
                value={newCode}
                onChange={(e) =>
                  setNewCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className={inputClass}
                required
              />
              <button
                type="submit"
                disabled={loading !== null || newCode.length !== 6}
                className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {loading === "verify-new" ? "Doğrulanıyor…" : "Doğrula"}
              </button>
            </form>
          )}
        </fieldset>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Kapat
          </button>
        </div>
      </div>
    </Modal>
  );
}
