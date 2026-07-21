"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { loadDashboardData, type DashboardData } from "@/lib/dashboard";
import { formatUsd, formatTl } from "@/lib/money";
import { formatDateTr } from "@/lib/dates";

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    loadDashboardData().then(setData);
  }, []);

  if (!data) {
    return <p className="p-10 text-center text-slate-500">Yükleniyor…</p>;
  }

  if (data.totalCustomers === 0) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 text-center">
        <p className="text-lg font-medium text-slate-700">
          Henüz müşteri eklenmedi.
        </p>
        <p className="mt-2 text-slate-500">
          Başlamak için{" "}
          <Link href="/customers" className="text-blue-600 underline">
            Müşterilerim
          </Link>{" "}
          sayfasından ilk müşterinizi oluşturun.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Toplam Müşteri" value={String(data.totalCustomers)} />
        <SummaryCard label="Toplam Fatura Tutarı" value={formatUsd(data.totalInvoicedFx)} />
        <SummaryCard label="Toplam Kur Farkı" value={formatTl(data.totalKurFarkiTl)} />
        <SummaryCard label="Toplam Açık Bakiye" value={formatUsd(data.totalOpenBalanceFx)} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">
            Aylık Kur Farkı Trendi
          </h2>
          <div className="mt-4 h-64">
            {data.monthlyKurFarki.length === 0 ? (
              <EmptyChart text="Henüz kapanmış ödeme yok." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.monthlyKurFarki}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => formatTl(String(v ?? 0))} />
                  <Line
                    type="monotone"
                    dataKey="amountTl"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">
            En Yüksek Bakiyeli 5 Müşteri
          </h2>
          <div className="mt-4 h-64">
            {data.topCustomers.length === 0 ? (
              <EmptyChart text="Henüz bakiye yok." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topCustomers} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => formatUsd(String(v ?? 0))} />
                  <Bar dataKey="balanceFx" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Son Hareketler</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {data.recentTransactions.length === 0 && (
            <li className="py-3 text-sm text-slate-400">Henüz hareket yok.</li>
          )}
          {data.recentTransactions.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <Link
                  href={`/customers/${t.customerId}`}
                  className="truncate font-medium text-slate-800 hover:underline"
                >
                  {t.customerName}
                </Link>
                <div className="text-xs text-slate-500">
                  {t.kind === "INVOICE" ? "Fatura" : "Ödeme"} · {t.docNo} ·{" "}
                  {formatDateTr(t.date)}
                </div>
              </div>
              <div className="font-medium tabular-nums text-slate-900">
                {formatUsd(t.amountFx)}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
        {value}
      </div>
    </div>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-slate-400">
      {text}
    </div>
  );
}
