"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addPayment,
  deletePayment,
  getCustomer,
  importIntoCustomer,
  listInvoices,
  listPayments,
  setOpeningBalance,
  updatePayment,
  type PaymentInput,
} from "@/lib/supabase/repo";
import type { Customer, Invoice, Payment } from "@/lib/types";
import { compute } from "@/lib/engine/fifo";
import { processZipFile, type ImportOutcome } from "@/lib/import";
import SummaryBar from "@/components/SummaryBar";
import LedgerTable from "@/components/LedgerTable";
import ExcludedList from "@/components/ExcludedList";
import UploadDropzone from "@/components/UploadDropzone";
import ImportReport from "@/components/ImportReport";
import PaymentForm from "@/components/PaymentForm";
import OpeningBalanceForm from "@/components/OpeningBalanceForm";

export default function CustomerScreen({ customerId }: { customerId: string }) {
  const [customer, setCustomer] = useState<Customer | null | undefined>(
    undefined,
  );
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);

  const [zipBusy, setZipBusy] = useState(false);
  const [zipOutcome, setZipOutcome] = useState<ImportOutcome | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [showOpeningForm, setShowOpeningForm] = useState(false);

  const reload = useCallback(async () => {
    const [c, inv, pay] = await Promise.all([
      getCustomer(customerId),
      listInvoices(customerId),
      listPayments(customerId),
    ]);
    setCustomer(c);
    setInvoices(inv);
    setPayments(pay);
  }, [customerId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const result = useMemo(() => {
    if (!invoices || !payments) return null;
    return compute({
      opening: customer?.openingBalance,
      invoices,
      payments,
    });
  }, [customer, invoices, payments]);

  // devir için önerilen tarih: en eski faturadan bir gün önce
  const suggestedOpeningDate = useMemo(() => {
    const earliest = invoices
      ?.filter((i) => !i.excluded)
      .map((i) => i.issueDate)
      .sort()[0];
    if (!earliest) return "";
    const d = new Date(`${earliest}T12:00:00`);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, [invoices]);

  if (customer === undefined || !result) {
    return <p className="p-10 text-center text-slate-500">Yükleniyor…</p>;
  }
  if (customer === null) {
    return (
      <div className="p-10 text-center">
        <p className="text-slate-600">Müşteri bulunamadı.</p>
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
    if (group.vkn !== customer!.customerVkn) {
      alert(
        `Seçilen müşteri (${group.name}) bu çalışmanın müşterisinden farklı. ` +
          `Farklı müşteri için ana sayfadan yeni çalışma açın.`,
      );
      return;
    }
    const { addedCount, alreadyExistingCount } =
      await importIntoCustomer(group);
    setZipOutcome(null);
    await reload();
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
            {customer.customerName}
          </h1>
          <p className="text-sm text-slate-500">
            VKN {customer.customerVkn}
            {customer.supplierName && <> · Satıcı: {customer.supplierName}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPaymentForm(true)}
            className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
          >
            + Ödeme ekle
          </button>
          <button
            type="button"
            onClick={() => setShowOpeningForm(true)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            {customer.openingBalance ? "Devir bakiyesi ✓" : "Devir bakiyesi"}
          </button>
          <UploadDropzone compact busy={zipBusy} onFile={handleExtraZip} />
          <button
            type="button"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                const { downloadWorkbook } = await import("@/lib/excel/export");
                await downloadWorkbook(customer!, result);
              } catch (err) {
                alert(
                  `Excel oluşturulamadı: ${err instanceof Error ? err.message : String(err)}`,
                );
              } finally {
                setExporting(false);
              }
            }}
            className="rounded-lg bg-emerald-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {exporting ? "Hazırlanıyor…" : "Excel ⬇"}
          </button>
        </div>
      </header>

      <div className="mt-6">
        <SummaryBar summary={result.summary} />
      </div>

      <div className="mt-6 space-y-4">
        <LedgerTable
          rows={result.rows}
          onEditPayment={(paymentId) => setEditingPaymentId(paymentId)}
          onDeletePayment={async (paymentId) => {
            if (confirm("Bu ödeme silinsin mi?")) {
              await deletePayment(paymentId);
              await reload();
            }
          }}
        />
        {invoices && <ExcludedList invoices={invoices} />}
      </div>

      {showPaymentForm && (
        <PaymentForm
          onCancel={() => setShowPaymentForm(false)}
          onSave={async (input: PaymentInput) => {
            await addPayment(customerId, input);
            setShowPaymentForm(false);
            await reload();
          }}
        />
      )}

      {editingPaymentId && payments && (
        <PaymentForm
          initial={payments.find((p) => p.id === editingPaymentId)}
          onCancel={() => setEditingPaymentId(null)}
          onSave={async (input: PaymentInput) => {
            await updatePayment(editingPaymentId, input);
            setEditingPaymentId(null);
            await reload();
          }}
        />
      )}

      {showOpeningForm && (
        <OpeningBalanceForm
          initial={customer.openingBalance}
          suggestedDate={suggestedOpeningDate}
          onCancel={() => setShowOpeningForm(false)}
          onSave={async (opening) => {
            await setOpeningBalance(customerId, opening);
            setShowOpeningForm(false);
            await reload();
          }}
        />
      )}

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
