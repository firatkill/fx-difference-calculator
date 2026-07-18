import Big from "big.js";
import { extractInvoiceXmls } from "@/lib/zip/extract";
import { parseInvoiceBatch } from "@/lib/parser/ubl";
import type { ParsedInvoice } from "@/lib/types";
import { round2 } from "@/lib/money";

/**
 * Yüklenen dış zip'i uçtan uca işler: çıkar → parse → müşteriye göre grupla.
 */

export interface CustomerGroup {
  vkn: string;
  name: string;
  supplierName?: string;
  invoices: ParsedInvoice[];
  validCount: number;
  excludedCount: number;
  /** Geçerli faturaların toplam USD'si */
  totalFx: string;
}

export interface ImportOutcome {
  zipCount: number;
  xmlCount: number;
  duplicateCount: number;
  errors: { path: string; message: string }[];
  groups: CustomerGroup[];
}

export async function processZipFile(
  file: File,
  onProgress?: (processedZips: number) => void,
): Promise<ImportOutcome> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const extracted = await extractInvoiceXmls(buffer, onProgress);

  const decoder = new TextDecoder("utf-8");
  const { invoices, duplicateCount } = parseInvoiceBatch(
    extracted.xmls.map((x) => ({ path: x.path, text: decoder.decode(x.data) })),
  );

  const byVkn = new Map<string, ParsedInvoice[]>();
  for (const inv of invoices) {
    const key = inv.customerVkn || "?";
    const list = byVkn.get(key);
    if (list) list.push(inv);
    else byVkn.set(key, [inv]);
  }

  const groups: CustomerGroup[] = [...byVkn.entries()]
    .map(([vkn, list]) => {
      const valid = list.filter((i) => !i.excluded);
      const total = valid.reduce((acc, i) => acc.plus(i.amountFx), new Big(0));
      const sample = valid[0] ?? list[0];
      return {
        vkn,
        name:
          vkn === "?"
            ? "(müşterisi belirlenemeyen belgeler)"
            : sample.customerName,
        supplierName: sample.supplierName,
        invoices: list,
        validCount: valid.length,
        excludedCount: list.length - valid.length,
        totalFx: round2(total),
      };
    })
    .sort((a, b) => b.validCount - a.validCount);

  return {
    zipCount: extracted.zipCount,
    xmlCount: extracted.xmls.length,
    duplicateCount,
    errors: extracted.errors,
    groups,
  };
}
