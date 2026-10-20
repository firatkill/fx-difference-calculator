import { describe, expect, it } from "vitest";
import Big from "big.js";
import { extractInvoiceXmls } from "@/lib/zip/extract";
import { parseInvoiceBatch } from "@/lib/parser/ubl";
import { SAMPLE_CUSTOMER, sampleArchive } from "../scripts/synthetic-invoices.mjs";

/**
 * Uçtan uca: sentetik örnek arşiv (ay klasörlerinde 6 fatura zipi + 1 açıkta
 * duran mükerrer xml + .DS_Store gürültüsü) kullanıcının yükleyeceği tek dış
 * zip olarak verilir ve tüm hat çalıştırılır. Gerçek fatura kullanılmaz.
 */

describe("uçtan uca: sentetik örnek arşiv", () => {
  it("dış zip → 6 tekil USD faturası, toplam 7.786,88 USD", async () => {
    const extracted = await extractInvoiceXmls(sampleArchive());
    expect(extracted.errors).toHaveLength(0);
    // 1 dış + 6 iç zip
    expect(extracted.zipCount).toBe(7);
    // 6 zip içi xml + 2025/08 altında açıkta duran 1 xml
    expect(extracted.xmls).toHaveLength(7);

    const decoder = new TextDecoder("utf-8");
    const { invoices, duplicateCount } = parseInvoiceBatch(
      extracted.xmls.map((x) => ({ path: x.path, text: decoder.decode(x.data) })),
    );

    // açıkta duran xml, ORN2025000001638'in kopyası → mükerrer
    expect(duplicateCount).toBe(1);
    expect(invoices).toHaveLength(6);

    // hepsi geçerli, USD, aynı müşteri
    for (const inv of invoices) {
      expect(inv.excluded).toBeUndefined();
      expect(inv.currency).toBe("USD");
      expect(inv.customerVkn).toBe(SAMPLE_CUSTOMER.vkn);
      expect(inv.rate).toMatch(/^\d+\.\d+$/);
    }

    const total = invoices.reduce((acc, inv) => acc.plus(inv.amountFx), new Big(0));
    expect(total.toFixed(2)).toBe("7786.88");

    // tarih aralığı: Temmuz–Kasım 2025
    const dates = invoices.map((i) => i.issueDate).sort();
    expect(dates[0]).toBe("2025-07-17");
    expect(dates[dates.length - 1]).toBe("2025-11-26");
  });
});
