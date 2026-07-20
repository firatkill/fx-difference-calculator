"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PasswordChangeForm from "@/components/PasswordChangeForm";
import EmailChangeModal from "@/components/EmailChangeModal";
import MfaSection from "@/components/MfaSection";

export default function HesabimScreen() {
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      setCurrentEmail(data.user?.email ?? null);
    }
    load();
  }, []);

  return (
    <>
      <main className="mx-auto max-w-md space-y-6 px-6 py-12">
        <h1 className="text-2xl font-bold text-slate-900">Hesabım</h1>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-800">E-posta</h2>
          <p className="mt-1 truncate text-sm text-slate-500">
            {currentEmail ?? "Yükleniyor…"}
          </p>
          <button
            type="button"
            disabled={!currentEmail}
            onClick={() => setShowEmailModal(true)}
            className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            E-postamı Değiştir
          </button>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-800">Şifre</h2>
          <p className="mt-1 text-sm text-slate-500">Şifrenizi değiştirin.</p>
          <div className="mt-4">
            <PasswordChangeForm />
          </div>
        </section>

        <MfaSection />
      </main>

      {showEmailModal && currentEmail && (
        <EmailChangeModal
          currentEmail={currentEmail}
          onCancel={() => setShowEmailModal(false)}
        />
      )}
    </>
  );
}
