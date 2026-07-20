"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/Modal";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";

interface Props {
  onEnrolled: () => void;
  onCancel: () => void;
}

/** Ham SVG string'i tarayıcıda <img> ile gösterilebilir bir data URI'ye çevirir */
function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export default function MfaEnrollModal({ onEnrolled, onCancel }: Props) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrDataUri, setQrDataUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const verifiedRef = useRef(false);
  const factorIdRef = useRef<string | null>(null);

  useEffect(() => {
    async function enroll() {
      const supabase = createClient();
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator",
      });
      if (enrollError) {
        setError(translateAuthError(enrollError.message));
        setLoading(false);
        return;
      }
      factorIdRef.current = data.id;
      setFactorId(data.id);
      setQrDataUri(svgToDataUri(data.totp.qr_code));
      setSecret(data.totp.secret);
      setLoading(false);
    }
    enroll();

    return () => {
      // Modal, faktör doğrulanmadan kapatıldıysa yetim kaydı temizle
      if (!verifiedRef.current && factorIdRef.current) {
        createClient()
          .auth.mfa.unenroll({ factorId: factorIdRef.current })
          .catch(() => {});
      }
    };
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || code.length !== 6) return;
    setError(null);
    setVerifying(true);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    setVerifying(false);

    if (verifyError) {
      setError(translateAuthError(verifyError.message));
      return;
    }
    verifiedRef.current = true;
    onEnrolled();
  }

  function handleCopy() {
    if (!secret) return;
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

  return (
    <Modal title="MFA'yı Etkinleştir" onClose={onCancel}>
      <div className="mt-4 space-y-4">
        {loading && <p className="text-sm text-slate-500">Hazırlanıyor…</p>}

        {!loading && qrDataUri && (
          <>
            <p className="text-sm text-slate-600">
              Google Authenticator, Authy gibi bir uygulamayla aşağıdaki QR
              kodu okutun.
            </p>
            <img
              src={qrDataUri}
              alt="MFA QR kodu"
              className="mx-auto h-48 w-48"
            />
            {secret && (
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <p className="text-xs text-slate-500">
                  QR okutamıyorsanız bu anahtarı elle girin:
                </p>
                <code className="mt-1 block break-all text-sm font-semibold text-slate-800">
                  {secret}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="mt-2 text-xs font-medium text-blue-600 hover:underline"
                >
                  {copied ? "Kopyalandı ✓" : "Kopyala"}
                </button>
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Uygulamadaki 6 haneli kod
                </label>
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
                  required
                  autoFocus
                />
              </div>

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
                  disabled={verifying || code.length !== 6}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  {verifying ? "Doğrulanıyor…" : "Doğrula"}
                </button>
              </div>
            </form>
          </>
        )}

        {!loading && !qrDataUri && (
          <>
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
          </>
        )}
      </div>
    </Modal>
  );
}
