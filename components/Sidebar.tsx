"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { listCustomers, type CustomerListItem } from "@/lib/supabase/repo";
import SignOutButton from "@/components/SignOutButton";

interface Props {
  open: boolean;
  onClose: () => void;
  userEmail: string;
}

/**
 * Sol sidebar: her iki ekran boyutunda da overlay (masaüstünde içerik
 * kaymaz). Mobilde tam genişlik (tüm sayfayı kaplar), md+'te sabit 16rem.
 * Müşteri listesi realtime değil — rota değiştiğinde yeniden çekilir
 * (bu projede zaten bilinçli bir tercih, bkz. docs/plan-platform.md).
 */
export default function Sidebar({ open, onClose, userEmail }: Props) {
  const pathname = usePathname();
  const [customers, setCustomers] = useState<CustomerListItem[] | null>(null);

  useEffect(() => {
    listCustomers()
      .then(setCustomers)
      .catch(() => setCustomers([]));
  }, [pathname]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-full flex-col bg-white shadow-xl transition-transform duration-200 md:w-64 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <span className="font-bold text-slate-900">Döviz Kuru Farkı</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Menüyü kapat"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <nav className="px-2 py-3">
          <Link
            href="/"
            onClick={onClose}
            className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Ana Sayfa
          </Link>
        </nav>

        <div className="flex-1 overflow-y-auto px-2">
          <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Müşterilerim
          </div>
          <ul className="space-y-1">
            {(customers ?? []).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/customers/${c.id}`}
                  onClick={onClose}
                  className="block truncate rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  {c.customerName}
                </Link>
              </li>
            ))}
            {customers?.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-400">
                Henüz müşteri yok
              </li>
            )}
          </ul>
        </div>

        <div className="border-t border-slate-200 p-3">
          <div className="truncate px-1 pb-2 text-xs text-slate-500">
            {userEmail}
          </div>
          <Link
            href="/hesabim"
            onClick={onClose}
            className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Hesabım
          </Link>
          <SignOutButton />
        </div>
      </aside>
    </>
  );
}
