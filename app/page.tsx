"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import UploadDropzone from "@/components/UploadDropzone";
import ImportReport from "@/components/ImportReport";
import { processZipFile, type ImportOutcome } from "@/lib/import";
import { deleteWorkspace, importIntoWorkspace, listWorkspaces } from "@/lib/db/repo";
import { formatDateTr } from "@/lib/dates";

export default function HomePage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const workspaces = useLiveQuery(listWorkspaces, []);

  async function handleFile(file: File) {
    setBusy(true);
    setProgress(0);
    try {
      const result = await processZipFile(file, setProgress);
      setOutcome(result);
    } catch (err) {
      alert(
        `Zip işlenemedi: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(vkn: string) {
    const group = outcome?.groups.find((g) => g.vkn === vkn);
    if (!group) return;
    setSaving(true);
    try {
      const { workspaceId } = await importIntoWorkspace(group);
      router.push(`/workspace?id=${workspaceId}`);
    } catch (err) {
      alert(
        `Kaydedilemedi: ${err instanceof Error ? err.message : String(err)}`,
      );
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Döviz Kuru Farkı</h1>
        <p className="mt-2 text-slate-600">
          e-Fatura zip dosyanızı yükleyin; faturalar FIFO mantığıyla ödemelerle
          eşleştirilip döviz kuru farkı hesaplansın. Verileriniz yalnızca bu
          tarayıcıda kalır, hiçbir sunucuya gönderilmez.
        </p>
      </header>

      <div className="mt-8">
        <UploadDropzone onFile={handleFile} busy={busy} />
        {busy && progress > 0 && (
          <p className="mt-2 text-center text-sm text-slate-500">
            {progress} zip tarandı…
          </p>
        )}
      </div>

      {workspaces && workspaces.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-800">
            Son çalışmalar
          </h2>
          <ul className="mt-3 space-y-2">
            {workspaces.map((w) => (
              <li
                key={w.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => router.push(`/workspace?id=${w.id}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate font-medium text-slate-900 hover:text-blue-700">
                    {w.customerName}
                  </div>
                  <div className="text-xs text-slate-500">
                    VKN {w.customerVkn} · {w.invoiceCount} fatura ·{" "}
                    {w.paymentCount} ödeme · son değişiklik{" "}
                    {formatDateTr(new Date(w.updatedAt).toISOString().slice(0, 10))}
                  </div>
                </button>
                <button
                  type="button"
                  title="Çalışmayı sil"
                  onClick={async () => {
                    if (
                      confirm(
                        `"${w.customerName}" çalışması ve tüm kayıtları silinsin mi?`,
                      )
                    ) {
                      await deleteWorkspace(w.id);
                    }
                  }}
                  className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  🗑️
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {outcome && (
        <ImportReport
          outcome={outcome}
          busy={saving}
          onConfirm={handleConfirm}
          onCancel={() => setOutcome(null)}
        />
      )}
    </main>
  );
}
