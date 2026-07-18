"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { deletePayment, importIntoWorkspace } from "@/lib/db/repo";
import { compute } from "@/lib/engine/fifo";
import { processZipFile, type ImportOutcome } from "@/lib/import";
import SummaryBar from "@/components/SummaryBar";
import LedgerTable from "@/components/LedgerTable";
import ExcludedList from "@/components/ExcludedList";
import UploadDropzone from "@/components/UploadDropzone";
import ImportReport from "@/components/ImportReport";

function WorkspaceScreen() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";

  const workspace = useLiveQuery(() => db.workspaces.get(id), [id]);
  const invoices = useLiveQuery(
    () => db.invoices.where("workspaceId").equals(id).toArray(),
    [id],
  );
  const payments = useLiveQuery(
    () => db.payments.where("workspaceId").equals(id).toArray(),
    [id],
  );

  const [zipBusy, setZipBusy] = useState(false);
  const [zipOutcome, setZipOutcome] = useState<ImportOutcome | null>(null);

  const result = useMemo(() => {
    if (!invoices || !payments) return null;
    return compute({
      opening: workspace?.openingBalance,
      invoices,
      payments,
    });
  }, [workspace, invoices, payments]);

  if (workspace === undefined || !result) {
    return <p className="p-10 text-center text-slate-500">Yükleniyor…</p>;
  }
  if (workspace === null) {
    return (
      <div className="p-10 text-center">
        <p className="text-slate-600">Çalışma dosyası bulunamadı.</p>
        <Link href="/" className="mt-2 inline-block text-blue-600 underline">
          ← Ana sayfaya dön
        </Link>
      </div>
    );
  }

  async function handleExtraZip(file: File) {
    setZipBusy(true);
    try {
      setZipOutcome(await processZipFile(file));
    } catch (err) {
      alert(
        `Zip işlenemedi: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setZipBusy(false);
    }
  }

  async function handleExtraZipConfirm(vkn: string) {
    const group = zipOutcome?.groups.find((g) => g.vkn === vkn);
    if (!group) return;
    if (group.vkn !== workspace!.customerVkn) {
      alert(
        `Seçilen müşteri (${group.name}) bu çalışmanın müşterisinden farklı. ` +
          `Farklı müşteri için ana sayfadan yeni çalışma açın.`,
      );
      return;
    }
    const { addedCount, alreadyExistingCount } =
      await importIntoWorkspace(group);
    setZipOutcome(null);
    alert(
      `${addedCount} yeni fatura eklendi` +
        (alreadyExistingCount > 0
          ? `, ${alreadyExistingCount} fatura zaten kayıtlıydı.`
          : "."),
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← Ana sayfa
          </Link>
          <h1 className="mt-1 truncate text-2xl font-bold text-slate-900">
            {workspace.customerName}
          </h1>
          <p className="text-sm text-slate-500">
            VKN {workspace.customerVkn}
            {workspace.supplierName && <> · Satıcı: {workspace.supplierName}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <UploadDropzone compact busy={zipBusy} onFile={handleExtraZip} />
        </div>
      </header>

      <div className="mt-6">
        <SummaryBar summary={result.summary} />
      </div>

      <div className="mt-6 space-y-4">
        <LedgerTable
          rows={result.rows}
          onDeletePayment={async (paymentId) => {
            if (confirm("Bu ödeme silinsin mi?")) await deletePayment(paymentId);
          }}
        />
        {invoices && <ExcludedList invoices={invoices} />}
      </div>

      {zipOutcome && (
        <ImportReport
          outcome={zipOutcome}
          onConfirm={handleExtraZipConfirm}
          onCancel={() => setZipOutcome(null)}
        />
      )}
    </main>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense
      fallback={<p className="p-10 text-center text-slate-500">Yükleniyor…</p>}
    >
      <WorkspaceScreen />
    </Suspense>
  );
}
