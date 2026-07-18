import Dexie, { type EntityTable } from "dexie";
import type { Invoice, Payment, Workspace } from "@/lib/types";

/**
 * IndexedDB şeması (Dexie). Hesap sonuçları saklanmaz; her açılışta
 * motor yeniden hesaplar (tek doğruluk kaynağı ham kayıtlardır).
 */
export const db = new Dexie("doviz-kuru-farki") as Dexie & {
  workspaces: EntityTable<Workspace, "id">;
  invoices: EntityTable<Invoice, "uuid">;
  payments: EntityTable<Payment, "id">;
};

db.version(1).stores({
  workspaces: "id, customerVkn, updatedAt",
  invoices: "uuid, workspaceId",
  payments: "id, workspaceId",
});
