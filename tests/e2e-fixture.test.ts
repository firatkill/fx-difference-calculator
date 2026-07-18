import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { zipSync } from "fflate";
import Big from "big.js";
import { extractInvoiceXmls } from "@/lib/zip/extract";
import { parseInvoiceBatch } from "@/lib/parser/ubl";

/**
 * Uçtan uca: docs/invoice_zip_example içeriği (25 gerçek fatura zipi +
 * 1 açıkta duran mükerrer xml + .DS_Store gürültüsü) kullanıcının
 * yükleyeceği tek dış zip haline getirilir ve tüm hat çalıştırılır.
 */

const srcDir = join(__dirname, "..", "docs", "invoice_zip_example");

function collect(dir: string, files: Record<string, Uint8Array> = {}) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collect(full, files);
    else files[relative(srcDir, full).split("\\").join("/")] = readFileSync(full);
  }
  return files;
}

describe("uçtan uca: gerçek örnek veri", () => {
  it("dış zip → 25 tekil USD faturası, toplam 4.321,00 USD", async () => {
    const outerZip = zipSync(collect(srcDir), { level: 0 });

    const extracted = await extractInvoiceXmls(outerZip);
    expect(extracted.errors).toHaveLength(0);
    // 1 dış + 25 iç zip
    expect(extracted.zipCount).toBe(26);
    // 25 zip içi xml + 2025/08 altında açıkta duran 1 xml
    expect(extracted.xmls).toHaveLength(26);

    const decoder = new TextDecoder("utf-8");
    const { invoices, duplicateCount } = parseInvoiceBatch(
      extracted.xmls.map((x) => ({ path: x.path, text: decoder.decode(x.data) })),
    );

    // açıkta duran xml, ORN2025000001638'in kopyası → mükerrer
    expect(duplicateCount).toBe(1);
    expect(invoices).toHaveLength(25);

    // hepsi geçerli, USD, aynı müşteri
    for (const inv of invoices) {
      expect(inv.excluded).toBeUndefined();
      expect(inv.currency).toBe("USD");
      expect(inv.customerVkn).toBe("3333333333");
      expect(inv.rate).toMatch(/^\d+\.\d+$/);
    }

    const total = invoices.reduce((acc, inv) => acc.plus(inv.amountFx), new Big(0));
    expect(total.toFixed(2)).toBe("4321.00");

    // tarih aralığı: Temmuz–Kasım 2025
    const dates = invoices.map((i) => i.issueDate).sort();
    expect(dates[0]).toBe("2025-07-17");
    expect(dates[dates.length - 1]).toBe("2025-11-26");
  });
});
