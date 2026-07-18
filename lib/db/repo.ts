import Big from "big.js";
import { db } from "@/lib/db/schema";
import type {
  Invoice,
  OpeningBalance,
  ParsedInvoice,
  Payment,
  Workspace,
} from "@/lib/types";
import { round2 } from "@/lib/money";

export interface ImportIntoWorkspaceResult {
  workspaceId: string;
  addedCount: number;
  alreadyExistingCount: number;
}

/**
 * Bir müşteri grubunun faturalarını ilgili workspace'e yazar.
 * Aynı VKN için workspace varsa birleştirir (UUID zaten varsa atlanır),
 * yoksa yeni workspace açar.
 */
export async function importIntoWorkspace(group: {
  vkn: string;
  name: string;
  supplierName?: string;
  invoices: ParsedInvoice[];
}): Promise<ImportIntoWorkspaceResult> {
  return db.transaction("rw", [db.workspaces, db.invoices], async () => {
    let workspace = await db.workspaces
      .where("customerVkn")
      .equals(group.vkn)
      .first();

    if (!workspace) {
      workspace = {
        id: crypto.randomUUID(),
        customerVkn: group.vkn,
        customerName: group.name,
        supplierName: group.supplierName,
        paymentCounter: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await db.workspaces.add(workspace);
    }

    const uuids = group.invoices.map((i) => i.uuid);
    const existing = await db.invoices.bulkGet(uuids);
    const existingSet = new Set(
      existing.filter((i): i is Invoice => !!i).map((i) => i.uuid),
    );

    const toAdd: Invoice[] = group.invoices
      .filter((i) => !existingSet.has(i.uuid))
      .map((i) => ({ ...i, workspaceId: workspace.id }));

    await db.invoices.bulkAdd(toAdd);
    await db.workspaces.update(workspace.id, { updatedAt: Date.now() });

    return {
      workspaceId: workspace.id,
      addedCount: toAdd.length,
      alreadyExistingCount: existingSet.size,
    };
  });
}

export interface PaymentInput {
  date: string;
  entryMode: "TL" | "USD";
  /** TL modunda girilen TL tutarı */
  amountTl?: string;
  /** USD karşılığı (çağıran hesaplar) */
  amountFx: string;
  rate: string;
  note?: string;
}

export async function addPayment(
  workspaceId: string,
  input: PaymentInput,
): Promise<Payment> {
  return db.transaction("rw", [db.workspaces, db.payments], async () => {
    const workspace = await db.workspaces.get(workspaceId);
    if (!workspace) throw new Error("Çalışma dosyası bulunamadı");

    const counter = workspace.paymentCounter + 1;
    const payment: Payment = {
      id: crypto.randomUUID(),
      workspaceId,
      docNo: `ÖD-${String(counter).padStart(4, "0")}`,
      seq: counter,
      ...input,
      amountFx: round2(new Big(input.amountFx)),
    };
    await db.payments.add(payment);
    await db.workspaces.update(workspaceId, {
      paymentCounter: counter,
      updatedAt: Date.now(),
    });
    return payment;
  });
}

export async function updatePayment(
  id: string,
  input: PaymentInput,
): Promise<void> {
  await db.transaction("rw", [db.workspaces, db.payments], async () => {
    const payment = await db.payments.get(id);
    if (!payment) throw new Error("Ödeme bulunamadı");
    await db.payments.update(id, {
      ...input,
      amountTl: input.amountTl, // undefined ise alanı temizle
      amountFx: round2(new Big(input.amountFx)),
    });
    await db.workspaces.update(payment.workspaceId, { updatedAt: Date.now() });
  });
}

export async function deletePayment(id: string): Promise<void> {
  await db.transaction("rw", [db.workspaces, db.payments], async () => {
    const payment = await db.payments.get(id);
    if (!payment) return;
    await db.payments.delete(id);
    await db.workspaces.update(payment.workspaceId, { updatedAt: Date.now() });
  });
}

export async function setOpeningBalance(
  workspaceId: string,
  opening: OpeningBalance | undefined,
): Promise<void> {
  await db.workspaces.update(workspaceId, {
    openingBalance: opening,
    updatedAt: Date.now(),
  });
}

export async function deleteWorkspace(id: string): Promise<void> {
  await db.transaction(
    "rw",
    [db.workspaces, db.invoices, db.payments],
    async () => {
      await db.invoices.where("workspaceId").equals(id).delete();
      await db.payments.where("workspaceId").equals(id).delete();
      await db.workspaces.delete(id);
    },
  );
}

export interface WorkspaceListItem extends Workspace {
  invoiceCount: number;
  paymentCount: number;
}

export async function listWorkspaces(): Promise<WorkspaceListItem[]> {
  const workspaces = await db.workspaces
    .orderBy("updatedAt")
    .reverse()
    .toArray();
  return Promise.all(
    workspaces.map(async (w) => ({
      ...w,
      invoiceCount: await db.invoices.where("workspaceId").equals(w.id).count(),
      paymentCount: await db.payments.where("workspaceId").equals(w.id).count(),
    })),
  );
}
