"use client";

import { Fragment, useState } from "react";
import type { LedgerRow } from "@/lib/engine/fifo";
import { formatDateTr } from "@/lib/dates";
import { big, formatRate, formatTl, formatTlSigned, formatUsd } from "@/lib/money";

interface Props {
  rows: LedgerRow[];
  onEditPayment?: (paymentId: string) => void;
  onDeletePayment?: (paymentId: string) => void;
}

const HEADERS = [
  "Tarih",
  "Belge No",
  "Vade",
  "Kur",
  "TL Tutar",
  "Döviz Tutar",
  "Ödenen",
  "Kalan",
  "Kur Farkı",
  "Bakiye",
  "",
];

function rowClasses(row: LedgerRow): string {
  if (row.kind === "PAYMENT") return "bg-green-50 hover:bg-green-100";
  if (row.kind === "OPENING") return "bg-sky-50 hover:bg-sky-100";
  // tamamen kapanmış fatura soluk
  if (row.remainingFx && big(row.remainingFx).eq(0)) {
    return "bg-white text-slate-400 hover:bg-slate-50";
  }
  return "bg-white hover:bg-slate-50";
}

function KindBadge({ kind }: { kind: LedgerRow["kind"] }) {
  if (kind === "PAYMENT") {
    return (
      <span className="mr-1.5 inline-block rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
        ÖDEME
      </span>
    );
  }
  if (kind === "OPENING") {
    return (
      <span className="mr-1.5 inline-block rounded bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
        DEVİR
      </span>
    );
  }
  return null;
}

/** Genişletilen satırdaki mahsup dökümü */
function AllocationDetail({ row }: { row: LedgerRow }) {
  if (row.allocations.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        {row.kind === "PAYMENT"
          ? "Bu ödeme henüz bir faturaya mahsup edilmedi (avans olarak bekliyor)."
          : "Bu belgeye henüz ödeme mahsup edilmedi."}
      </p>
    );
  }

  const isPayment = row.kind === "PAYMENT";
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Mahsup Detayı
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500">
            <th className="py-1 pr-4 font-medium">
              {isPayment ? "Kapatılan Belge" : "Ödeme"}
            </th>
            <th className="py-1 pr-4 font-medium">Mahsup (USD)</th>
            <th className="py-1 pr-4 font-medium">Fatura Kuru</th>
            <th className="py-1 pr-4 font-medium">Ödeme Kuru</th>
            <th className="py-1 font-medium">Kur Farkı (TL)</th>
          </tr>
        </thead>
        <tbody>
          {row.allocations.map((a, i) => (
            <tr key={i} className="border-t border-slate-200">
              <td className="py-1.5 pr-4 font-medium">
                {isPayment ? a.invoiceDocNo : a.paymentDocNo}
              </td>
              <td className="py-1.5 pr-4 tabular-nums">
                {formatUsd(a.amountFx)}
              </td>
              <td className="py-1.5 pr-4 tabular-nums">
                {a.invoiceRate ? formatRate(a.invoiceRate) : "bilinmiyor"}
              </td>
              <td className="py-1.5 pr-4 tabular-nums">
                {formatRate(a.paymentRate)}
              </td>
              <td className="py-1.5 tabular-nums">
                {a.kurFarkiTl ? formatTlSigned(a.kurFarkiTl) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {row.note && (
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-medium">Açıklama:</span> {row.note}
        </p>
      )}
      {row.kind === "INVOICE" && row.taxInclusiveFx && (
        <p className="mt-2 text-xs text-slate-500">
          KDV dahil toplam: {formatUsd(row.taxInclusiveFx)} · Cari borç
          (tevkifat düşülmüş): {formatUsd(row.amountFx)}
        </p>
      )}
    </div>
  );
}

export default function LedgerTable({
  rows,
  onEditPayment,
  onDeletePayment,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
        Henüz kayıt yok. Zip yükleyin veya ödeme ekleyin.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[960px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            {HEADERS.map((h, i) => (
              <th
                key={i}
                className={`px-3 py-2.5 ${i >= 3 && i <= 9 ? "text-right" : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Fragment key={row.key}>
              <tr
                onClick={() =>
                  setExpanded(expanded === row.key ? null : row.key)
                }
                className={`cursor-pointer border-b border-slate-100 transition-colors ${rowClasses(row)}`}
              >
                <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                  {formatDateTr(row.date)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-medium">
                  <KindBadge kind={row.kind} />
                  {row.docNo}
                </td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-500">
                  {formatDateTr(row.dueDate)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {row.rate ? formatRate(row.rate) : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {row.amountTl ? formatTl(row.amountTl) : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">
                  {formatUsd(row.amountFx)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {row.kind !== "PAYMENT" && row.paidFx
                    ? formatUsd(row.paidFx)
                    : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {row.kind !== "PAYMENT" && row.remainingFx ? (
                    big(row.remainingFx).gt(0) ? (
                      <span className="font-semibold text-red-600">
                        {formatUsd(row.remainingFx)}
                      </span>
                    ) : (
                      formatUsd(row.remainingFx)
                    )
                  ) : (
                    "—"
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {row.kind === "PAYMENT" ? (
                    <span className="font-semibold text-blue-700">
                      {row.kurFarkiTl ? formatTlSigned(row.kurFarkiTl) : "—"}
                      {row.hasUnknownRate && (
                        <span title="Kursuz devir dilimi: kur farkı hesaplanamadı">
                          {" "}
                          *
                        </span>
                      )}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums">
                  {formatUsd(row.runningBalanceFx)}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right">
                  {row.kind === "PAYMENT" && (onEditPayment || onDeletePayment) && (
                    <span className="flex justify-end gap-1">
                      {onEditPayment && (
                        <button
                          type="button"
                          title="Düzenle"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditPayment(row.key);
                          }}
                          className="rounded p-1 text-slate-500 hover:bg-white hover:text-blue-600"
                        >
                          ✏️
                        </button>
                      )}
                      {onDeletePayment && (
                        <button
                          type="button"
                          title="Sil"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeletePayment(row.key);
                          }}
                          className="rounded p-1 text-slate-500 hover:bg-white hover:text-red-600"
                        >
                          🗑️
                        </button>
                      )}
                    </span>
                  )}
                </td>
              </tr>
              {expanded === row.key && (
                <tr className="border-b border-slate-200 bg-slate-50">
                  <td colSpan={HEADERS.length} className="px-6 py-4">
                    <AllocationDetail row={row} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
