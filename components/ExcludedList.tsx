"use client";

import type { Invoice } from "@/lib/types";
import { formatDateTr } from "@/lib/dates";

const REASON_LABELS: Record<string, string> = {
  NON_USD: "USD değil",
  IADE: "İade faturası",
  NO_RATE: "Kur bilgisi yok",
  PARSE_ERROR: "Okunamadı",
};

/** Hesaba katılmayan belgeler (TRY / İade / kursuz / hatalı) */
export default function ExcludedList({ invoices }: { invoices: Invoice[] }) {
  const excluded = invoices.filter((i) => i.excluded);
  if (excluded.length === 0) return null;

  return (
    <details className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-amber-800">
        Hesaba katılmayan {excluded.length} belge
      </summary>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-amber-700">
            <th className="py-1 pr-4 font-medium">Belge No</th>
            <th className="py-1 pr-4 font-medium">Tarih</th>
            <th className="py-1 pr-4 font-medium">Sebep</th>
            <th className="py-1 font-medium">Detay</th>
          </tr>
        </thead>
        <tbody>
          {excluded.map((inv) => (
            <tr key={inv.uuid} className="border-t border-amber-200/60">
              <td className="py-1.5 pr-4 font-medium">{inv.docNo}</td>
              <td className="py-1.5 pr-4 tabular-nums">
                {formatDateTr(inv.issueDate)}
              </td>
              <td className="py-1.5 pr-4">
                <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-semibold text-amber-900">
                  {REASON_LABELS[inv.excluded!.reason] ?? inv.excluded!.reason}
                </span>
              </td>
              <td className="py-1.5 text-xs text-amber-800">
                {inv.excluded!.detail ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
