"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { createCustomer } from "@/lib/supabase/repo";

interface Props {
  onCreated: (customerId: string) => void;
  onCancel: () => void;
}

export default function CreateCustomerModal({ onCreated, onCancel }: Props) {
  const [name, setName] = useState("");
  const [vkn, setVkn] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Müşteri adı girin.");
    if (!vkn.trim()) return setError("VKN girin.");

    setSaving(true);
    setError(null);
    try {
      const customer = await createCustomer({
        vkn: vkn.trim(),
        name: name.trim(),
        supplierName: supplierName.trim() || undefined,
      });
      onCreated(customer.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <Modal title="Yeni Müşteri" onClose={onCancel}>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Müşteri adı
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">VKN</label>
          <input
            type="text"
            value={vkn}
            onChange={(e) => setVkn(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Satıcı adı{" "}
            <span className="font-normal text-slate-400">(isteğe bağlı)</span>
          </label>
          <input
            type="text"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
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
            {saving ? "Kaydediliyor…" : "Oluştur"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
