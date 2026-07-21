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
import { processZipFile } from "@/lib/import";
import SummaryBar from "@/components/SummaryBar";
import LedgerTable from "@/components/LedgerTable";
import ExcludedList from "@/components/ExcludedList";
import UploadDropzone from "@/components/UploadDropzone";
import PaymentForm from "@/components/PaymentForm";
import OpeningBalanceForm from "@/components/OpeningBalanceForm";

interface ZipMismatch {
  found: { vkn: string; name: string }[];
}

export default function CustomerScreen({ customerId }: { customerId: string }) {
  const [customer, setCustomer] = useState<Customer | null | undefined>(
    undefined,
  );
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);

  const [zipBusy, setZipBusy] = useState(false);
  const [zipError, setZipError] = useState<ZipMismatch | null>(null);
  const [zipResultMsg, setZipResultMsg] = useState<string | null>(null);
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
    setZipError(null);
    setZipResultMsg(null);
    try {
      const outcome = await processZipFile(file);
      const match = outcome.groups.find((g) => g.vkn === customer!.customerVkn);
      if (!match) {
        setZipError({
          found: outcome.groups
            .filter((g) => g.vkn !== "?")
            .map((g) => ({ vkn: g.vkn, name: g.name })),
        });
        return;
      }
      const { addedCount, alreadyExistingCount } = await importIntoCustomer(match);
      await reload();
      setZipResultMsg(
        `${addedCount} yeni fatura eklendi` +
          (alreadyExistingCount > 0
            ? `, ${alreadyExistingCount} fatura zaten kayıtlıydı.`
            : "."),
      );
    } catch {
      setZipError({ found: [] });
    } finally {
      setZipBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="text-sm text-slate-500">
          VKN {customer.customerVkn}
          {customer.supplierName && <> · Satıcı: {customer.supplierName}</>}
        </p>
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
      </div>

      {zipError && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {zipError.found.length > 0 ? (
            <>
              Yüklenen zip bu müşteriyle eşleşmiyor. Bu müşteri:{" "}
              <strong>{customer.customerName}</strong> (VKN{" "}
              {customer.customerVkn}). Zip içinde bulunan:{" "}
              {zipError.found.map((g) => `${g.name} (VKN ${g.vkn})`).join(", ")}.
            </>
          ) : (
            "Zip işlenemedi veya okunabilir e-Fatura bulunamadı."
          )}
        </div>
      )}
      {zipResultMsg && (
        <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {zipResultMsg}
        </div>
      )}

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
    </main>
  );
}
