"use client";

import type { Summary } from "@/lib/engine/fifo";
import { big, formatTlSigned, formatUsd } from "@/lib/money";

function Card({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative" | "accent";
  hint?: string;
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-700"
      : tone === "negative"
        ? "text-red-700"
        : tone === "accent"
          ? "text-blue-700"
          : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${toneClass}`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-amber-600">{hint}</div>}
    </div>
  );
}

export default function SummaryBar({ summary }: { summary: Summary }) {
  const balance = big(summary.balanceFx);
  const kurFarki = big(summary.totalKurFarkiTl);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Card
        label="Devir"
        value={summary.openingFx ? formatUsd(summary.openingFx) : "—"}
      />
      <Card
        label={`Toplam Fatura (${summary.invoiceCount})`}
        value={formatUsd(summary.totalInvoicedFx)}
      />
      <Card
        label={`Toplam Ödeme (${summary.paymentCount})`}
        value={formatUsd(summary.totalPaidFx)}
        tone="positive"
      />
      <Card
        label={balance.lt(0) ? "Müşteri Alacağı (Avans)" : "Kalan Bakiye"}
        value={formatUsd(balance.abs())}
        tone={balance.gt(0) ? "negative" : balance.lt(0) ? "positive" : "default"}
      />
      <Card
        label="Toplam Kur Farkı"
        value={formatTlSigned(kurFarki)}
        tone="accent"
        hint={
          summary.hasUnknownKurFarki
            ? "Kursuz devir dilimi hariç (eksik)"
            : undefined
        }
      />
    </div>
  );
}
