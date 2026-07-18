import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseUblInvoice, parseInvoiceBatch } from "@/lib/parser/ubl";

const exampleXml = readFileSync(
  join(
    __dirname,
    "..",
    "docs",
    "invoice_example",
    "a1b2c3d4-0000-4000-8000-000000000001.xml",
  ),
  "utf-8",
);

describe("parseUblInvoice — gerçek örnek fatura", () => {
  const inv = parseUblInvoice(exampleXml, "2025/08/ORN2025000001638.zip!/f.xml");

  it("plan bölüm 4'teki alan eşlemesini birebir çıkarır", () => {
    expect(inv.docNo).toBe("ORN2025000001638");
    expect(inv.uuid).toBe("a1b2c3d4-0000-4000-8000-000000000001");
    expect(inv.issueDate).toBe("2025-08-01");
    expect(inv.invoiceType).toBe("TEVKIFAT");
    expect(inv.currency).toBe("USD");
    expect(inv.rate).toBe("40.6467");
    expect(inv.amountFx).toBe("569.78");
    expect(inv.taxInclusiveFx).toBe("621.58");
    expect(inv.dueDate).toBe("2025-11-29");
    expect(inv.customerVkn).toBe("3333333333");
    expect(inv.customerName).toContain("ÖRNEK MÜŞTERİ");
    expect(inv.supplierName).toContain("ÖRNEK TEDARİKÇİ");
  });

  it("geçerli faturayı hesaba katar (excluded yok)", () => {
    expect(inv.excluded).toBeUndefined();
  });
});

/** Sentetik minimal fatura üretici */
function makeXml(opts: {
  currency?: string;
  type?: string;
  rate?: string;
  noteRate?: string;
  payable?: string;
}): string {
  const {
    currency = "USD",
    type = "SATIS",
    rate,
    noteRate,
    payable = "100.00",
  } = opts;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <cbc:ID>TST2025000000001</cbc:ID>
  <cbc:UUID>00000000-0000-0000-0000-00000000000${Math.floor(Math.random() * 10)}</cbc:UUID>
  <cbc:IssueDate>2025-01-15</cbc:IssueDate>
  <cbc:InvoiceTypeCode>${type}</cbc:InvoiceTypeCode>
  ${noteRate ? `<cbc:Note>Döviz Kuru:${noteRate}</cbc:Note>` : ""}
  <cbc:Note>Vade Tarihi : 15.04.2025</cbc:Note>
  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PartyIdentification><cbc:ID schemeID="VKN">1111111111</cbc:ID></cac:PartyIdentification>
    <cac:PartyName><cbc:Name>SATICI A.Ş.</cbc:Name></cac:PartyName>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party>
    <cac:PartyIdentification><cbc:ID schemeID="VKN">2222222222</cbc:ID></cac:PartyIdentification>
    <cac:PartyName><cbc:Name>MÜŞTERİ LTD.</cbc:Name></cac:PartyName>
  </cac:Party></cac:AccountingCustomerParty>
  ${
    rate
      ? `<cac:PricingExchangeRate>
    <cbc:SourceCurrencyCode>${currency}</cbc:SourceCurrencyCode>
    <cbc:TargetCurrencyCode>TRY</cbc:TargetCurrencyCode>
    <cbc:CalculationRate>${rate}</cbc:CalculationRate>
  </cac:PricingExchangeRate>`
      : ""
  }
  <cac:LegalMonetaryTotal>
    <cbc:TaxInclusiveAmount currencyID="${currency}">${payable}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${currency}">${payable}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;
}

describe("parseUblInvoice — dışlama kuralları", () => {
  it("TRY faturayı NON_USD olarak dışlar", () => {
    const inv = parseUblInvoice(
      makeXml({ currency: "TRY", rate: "1" }),
      "t.xml",
    );
    expect(inv.excluded?.reason).toBe("NON_USD");
  });

  it("İADE faturasını dışlar", () => {
    const inv = parseUblInvoice(
      makeXml({ type: "IADE", rate: "40.5" }),
      "t.xml",
    );
    expect(inv.excluded?.reason).toBe("IADE");
  });

  it("kur alanı yoksa nottaki 'Döviz Kuru' değerine düşer (virgüllü)", () => {
    const inv = parseUblInvoice(makeXml({ noteRate: "40,6467" }), "t.xml");
    expect(inv.excluded).toBeUndefined();
    expect(inv.rate).toBe("40.6467");
  });

  it("hiçbir kur bulunamazsa NO_RATE olarak dışlar", () => {
    const inv = parseUblInvoice(makeXml({}), "t.xml");
    expect(inv.excluded?.reason).toBe("NO_RATE");
  });

  it("bozuk XML'i PARSE_ERROR kaydına çevirir (fırlatmaz)", () => {
    const inv = parseUblInvoice("<bozuk>", "kirik.xml");
    expect(inv.excluded?.reason).toBe("PARSE_ERROR");
  });

  it("vade tarihini nottan ISO'ya çevirir", () => {
    const inv = parseUblInvoice(makeXml({ rate: "40.5" }), "t.xml");
    expect(inv.dueDate).toBe("2025-04-15");
  });
});

describe("parseInvoiceBatch", () => {
  it("aynı UUID'yi bir kez alır, mükerrerleri sayar", () => {
    const xml = makeXml({ rate: "40.5" });
    const { invoices, duplicateCount } = parseInvoiceBatch([
      { path: "a.xml", text: xml },
      { path: "b.xml", text: xml },
    ]);
    expect(invoices).toHaveLength(1);
    expect(duplicateCount).toBe(1);
  });
});
