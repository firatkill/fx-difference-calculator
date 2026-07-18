"use client";

import { useState } from "react";
import type { ImportOutcome } from "@/lib/import";
import { formatUsd } from "@/lib/money";

interface Props {
  outcome: ImportOutcome;
  onConfirm: (groupVkn: string) => void;
  onCancel: () => void;
  busy?: boolean;
}

/**
 * İçe aktarma raporu + müşteri seçimi.
 * Tek müşteri çıktıysa otomatik seçilir, kullanıcı sadece onaylar.
 */
export default function ImportReport({
  outcome,
  onConfirm,
  onCancel,
  busy,
}: Props) {
  const selectable = outcome.groups.filter((g) => g.vkn !== "?");
  const [selected, setSelected] = useState<string | null>(
    selectable.length === 1 ? selectable[0].vkn : null,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold text-slate-900">İçe Aktarma Raporu</h2>

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-slate-100 px-3 py-1">
            {outcome.zipCount} zip tarandı
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1">
            {outcome.xmlCount} belge okundu
          </span>
          {outcome.duplicateCount > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">
              {outcome.duplicateCount} mükerrer atlandı
            </span>
          )}
          {outcome.errors.length > 0 && (
            <span className="rounded-full bg-red-100 px-3 py-1 text-red-800">
              {outcome.errors.length} hata
            </span>
          )}
        </div>

        {outcome.errors.length > 0 && (
          <details className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            <summary className="cursor-pointer font-medium">
              Hata detayları
            </summary>
            <ul className="mt-2 list-inside list-disc space-y-1">
              {outcome.errors.map((e, i) => (
                <li key={i}>
                  <code className="text-xs">{e.path}</code>: {e.message}
                </li>
              ))}
            </ul>
          </details>
        )}

        <h3 className="mt-6 font-semibold text-slate-800">
          {selectable.length > 1
            ? "Birden fazla müşteri bulundu — hangisiyle çalışılsın?"
            : "Bulunan müşteri"}
        </h3>

        <div className="mt-3 space-y-2">
          {outcome.groups.map((g) => {
            const disabled = g.vkn === "?" || g.validCount === 0;
            return (
              <label
                key={g.vkn}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  disabled
                    ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
                    : selected === g.vkn
                      ? "cursor-pointer border-blue-500 bg-blue-50"
                      : "cursor-pointer border-slate-200 hover:border-blue-300"
                }`}
              >
                <input
                  type="radio"
                  name="customer"
                  disabled={disabled}
                  checked={selected === g.vkn}
                  onChange={() => setSelected(g.vkn)}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-900">
                    {g.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {g.vkn !== "?" && <>VKN {g.vkn} · </>}
                    {g.validCount} geçerli fatura · {formatUsd(g.totalFx)}
                    {g.excludedCount > 0 && (
                      <span className="text-amber-600">
                        {" "}
                        · {g.excludedCount} hesaba katılmayacak
                      </span>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
          {outcome.groups.length === 0 && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Zip içinde okunabilir e-Fatura bulunamadı.
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={!selected || busy}
            onClick={() => selected && onConfirm(selected)}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {busy ? "Kaydediliyor…" : "Devam et →"}
          </button>
        </div>
      </div>
    </div>
  );
}
