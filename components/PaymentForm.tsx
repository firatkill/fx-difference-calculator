"use client";

import { useMemo, useState } from "react";
import Big from "big.js";
import Modal from "@/components/Modal";
import type { PaymentInput } from "@/lib/db/repo";
import type { Payment } from "@/lib/types";
import { big, formatTl, formatUsd, parseNumberInput, round2 } from "@/lib/money";
import { todayIso } from "@/lib/dates";

interface Props {
  /** Doluysa düzenleme modu */
  initial?: Payment;
  onSave: (input: PaymentInput) => Promise<void> | void;
  onCancel: () => void;
}

export default function PaymentForm({ initial, onSave, onCancel }: Props) {
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [mode, setMode] = useState<"TL" | "USD">(initial?.entryMode ?? "TL");
  const [amountText, setAmountText] = useState(
    initial ? (initial.entryMode === "TL" ? (initial.amountTl ?? "") : initial.amountFx) : "",
  );
  const [rateText, setRateText] = useState(initial?.rate ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
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

  // canlı çevrim önizlemesi
  const preview = useMemo(() => {
    if (!amount || !rate) return null;
    if (mode === "TL") {
      const fx = new Big(amount).div(rate);
      return `${formatTl(amount)} ÷ ${rateText} = ${formatUsd(round2(fx))}`;
    }
    const tl = new Big(amount).times(rate);
    return `${formatUsd(amount)} × ${rateText} = ${formatTl(round2(tl))}`;
  }, [amount, rate, mode, rateText]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return setError("Tarih girin.");
    if (!amount) return setError("Geçerli bir tutar girin (örn. 250.000,00).");
    if (!rate) return setError("Geçerli bir kur girin (örn. 41,6440).");

    const input: PaymentInput =
      mode === "TL"
        ? {
            date,
            entryMode: "TL",
            amountTl: round2(new Big(amount)),
            amountFx: round2(new Big(amount).div(rate)),
            rate,
            note: note.trim() || undefined,
          }
        : {
            date,
            entryMode: "USD",
            amountTl: undefined,
            amountFx: round2(new Big(amount)),
            rate,
            note: note.trim() || undefined,
          };

    setSaving(true);
    try {
      await onSave(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

  return (
    <Modal
      title={initial ? `Ödemeyi Düzenle (${initial.docNo})` : "Ödeme Ekle"}
      onClose={onCancel}
    >
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Ödeme tarihi
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
            required
          />
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Tutar cinsi
          </span>
          <div className="flex overflow-hidden rounded-lg border border-slate-300">
            {(["TL", "USD"] as const).map((m) => (
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
              placeholder={mode === "TL" ? "250.000,00" : "6.003,26"}
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Kur (USD/TL)
            </label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="41,6440"
              value={rateText}
              onChange={(e) => setRateText(e.target.value)}
              className={inputClass}
              required
            />
          </div>
        </div>

        {preview && (
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 tabular-nums">
            {preview}
          </p>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Açıklama <span className="font-normal text-slate-400">(isteğe bağlı, örn. dekont no)</span>
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputClass}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
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
      </form>
    </Modal>
  );
}
