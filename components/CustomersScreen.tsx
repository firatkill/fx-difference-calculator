"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteCustomer,
  listCustomers,
  type CustomerListItem,
} from "@/lib/supabase/repo";
import { formatDateTr } from "@/lib/dates";
import CreateCustomerModal from "@/components/CreateCustomerModal";

export default function CustomersScreen() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerListItem[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const reload = useCallback(async () => {
    setCustomers(await listCustomers());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Müşterilerim</h2>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Yeni Müşteri
        </button>
      </div>

      {customers && customers.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">Henüz müşteri yok.</p>
      )}

      <ul className="mt-4 space-y-2">
        {(customers ?? []).map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <button
              type="button"
              onClick={() => router.push(`/customers/${c.id}`)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="truncate font-medium text-slate-900 hover:text-blue-700">
                {c.customerName}
              </div>
              <div className="text-xs text-slate-500">
                VKN {c.customerVkn} · {c.invoiceCount} fatura ·{" "}
                {c.paymentCount} ödeme · son değişiklik{" "}
                {formatDateTr(new Date(c.updatedAt).toISOString().slice(0, 10))}
              </div>
            </button>
            <button
              type="button"
              title="Müşteriyi sil"
              onClick={async () => {
                if (
                  confirm(`"${c.customerName}" ve tüm kayıtları silinsin mi?`)
                ) {
                  await deleteCustomer(c.id);
                  await reload();
                }
              }}
              className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
            >
              🗑️
            </button>
          </li>
        ))}
      </ul>

      {showCreate && (
        <CreateCustomerModal
          onCancel={() => setShowCreate(false)}
          onCreated={(id) => router.push(`/customers/${id}`)}
        />
      )}
    </main>
  );
}
