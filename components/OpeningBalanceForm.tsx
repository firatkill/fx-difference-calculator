"use client";

import { useMemo, useState } from "react";
import Big from "big.js";
import Modal from "@/components/Modal";
import type { OpeningBalance } from "@/lib/types";
import { big, formatTl, formatUsd, parseNumberInput, round2 } from "@/lib/money";

interface Props {
  initial?: OpeningBalance;
  /** Varsayılan devir tarihi (en eski faturadan önce olmalı) */
  suggestedDate: string;
  onSave: (opening: OpeningBalance | undefined) => Promise<void> | void;
  onCancel: () => void;
}

/**
 * Devir (açılış) bakiyesi: zip'ten önceki dönemden gelen borç.
 * USD modunda kur isteğe bağlıdır; girilmezse bu dilime kur farkı hesaplanmaz.
 */
export default function OpeningBalanceForm({
  initial,
  suggestedDate,
  onSave,
  onCancel,
}: Props) {
  const [date, setDate] = useState(initial?.date ?? suggestedDate);
  const [mode, setMode] = useState<"TL" | "USD">(initial?.entryMode ?? "USD");
  const [amountText, setAmountText] = useState(
    initial ? (initial.entryMode === "TL" ? (initial.amountTl ?? "") : initial.amountFx) : "",
  );
  const [rateText, setRateText] = useState(initial?.rate ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = useMemo(() => {
    const parsed = amountText ? parseNumberInput(amountText) : null;
    return parsed && big(parsed).gt(0) ? parsed : null;
  }, [amountText]);
  const rate = useMemo(() => {
    const parsed = rateText ? parseNumberInput(rateText) : null;
    return parsed && big(parsed).gt(0) ? parsed : null;
  }, [rateText]);

  const preview = useMemo(() => {
    if (!amount) return null;
    if (mode === "TL") {
      if (!rate) return null;
      return `${formatTl(amount)} ÷ ${rateText} = ${formatUsd(round2(new Big(amount).div(rate)))}`;
    }
    if (rate) {
      return `${formatUsd(amount)} × ${rateText} = ${formatTl(round2(new Big(amount).times(rate)))}`;
    }
    return null;
  }, [amount, rate, mode, rateText]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return setError("Tarih girin.");
    if (!amount) return setError("Geçerli bir tutar girin.");
    if (mode === "TL" && !rate)
      return setError("TL girişinde kur zorunludur (dövize çevirmek için).");

    const opening: OpeningBalance =
      mode === "TL"
        ? {
            date,
            entryMode: "TL",
            amountTl: round2(new Big(amount)),
            amountFx: round2(new Big(amount).div(rate!)),
            rate: rate!,
          }
        : {
            date,
            entryMode: "USD",
            amountFx: round2(new Big(amount)),
            rate: rate ?? undefined,
          };

    setSaving(true);
    try {
      await onSave(opening);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

  return (
    <Modal title="Devir Bakiyesi" onClose={onCancel}>
      <p className="mt-2 text-sm text-slate-500">
        Yüklenen faturalardan önceki dönemden kalan borç. FIFO sırasında en
        başa konur; ödemeler önce devri kapatır.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Devir tarihi
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
            required
          />
          <p className="mt-1 text-xs text-slate-400">
            En eski faturadan önce bir tarih seçin.
          </p>
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Tutar cinsi
          </span>
          <div className="flex overflow-hidden rounded-lg border border-slate-300">
            {(["USD", "TL"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 px-3 py-2 text-sm font-semibold ${
                  mode === m
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {m === "TL" ? "₺ TL" : "$ USD"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Tutar ({mode === "TL" ? "₺" : "$"})
            </label>
            <input
              type="text"
              inputMode="decimal"
              placeholder={mode === "TL" ? "100.000,00" : "5.000,00"}
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Kur{" "}
              {mode === "USD" && (
                <span className="font-normal text-slate-400">(isteğe bağlı)</span>
              )}
            </label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="40,5000"
              value={rateText}
              onChange={(e) => setRateText(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {mode === "USD" && !rate && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Kur girilmezse devire mahsup edilen ödemeler için kur farkı
            hesaplanamaz (tabloda “—” gösterilir).
          </p>
        )}
        {preview && (
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 tabular-nums">
            {preview}
          </p>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          {initial ? (
            <button
              type="button"
              onClick={() => onSave(undefined)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Deviri kaldır
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
