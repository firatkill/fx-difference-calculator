// Sentetik e-Fatura örnekleri: testler ve `npm run make-fixture` buradan beslenir.
// Bütün firma adları, VKN'ler, belge numaraları ve UUID'ler uydurmadır; repoya
// gerçek fatura konmaz. Yapı, gerçek GİB faturalarındaki dikkat edilmesi gereken
// noktaları taklit eder: imza bloğu (UBLExtensions), gömülü XSLT eki, tevkifat
// nedeniyle PayableAmount < TaxInclusiveAmount, notta vade tarihi, döviz kuru.
import { strToU8, zipSync } from "fflate";

export const SAMPLE_SUPPLIER = { vkn: "4444444444", name: "ÖRNEK TEDARİKÇİ LTD. ŞTİ." };
export const SAMPLE_CUSTOMER = { vkn: "3333333333", name: "ÖRNEK MÜŞTERİ SANAYİ LTD. ŞTİ." };

/** Altı USD tevkifat faturası, Temmuz–Kasım 2025 */
export const SAMPLE_INVOICES = [
  { folder: "2025/07", docNo: "ORN2025000001536", uuid: "a1b2c3d4-0000-4000-8000-000000000101", issueDate: "2025-07-17", due: "14.10.2025", rate: "40.2101", taxInclusive: "1307.40", payable: "1198.45" },
  { folder: "2025/07", docNo: "ORN2025000001574", uuid: "a1b2c3d4-0000-4000-8000-000000000102", issueDate: "2025-07-28", due: "25.10.2025", rate: "40.3512", taxInclusive: "862.20", payable: "790.35" },
  { folder: "2025/08", docNo: "ORN2025000001638", uuid: "a1b2c3d4-0000-4000-8000-000000000001", issueDate: "2025-08-01", due: "29.11.2025", rate: "40.6467", taxInclusive: "621.58", payable: "569.78" },
  { folder: "2025/09", docNo: "ORN2025000001702", uuid: "a1b2c3d4-0000-4000-8000-000000000103", issueDate: "2025-09-12", due: "11.12.2025", rate: "41.2850", taxInclusive: "2049.60", payable: "1878.80" },
  { folder: "2025/10", docNo: "ORN2025000001777", uuid: "a1b2c3d4-0000-4000-8000-000000000104", issueDate: "2025-10-06", due: "04.01.2026", rate: "41.7003", taxInclusive: "414.00", payable: "379.50" },
  { folder: "2025/11", docNo: "ORN2025000001845", uuid: "a1b2c3d4-0000-4000-8000-000000000105", issueDate: "2025-11-26", due: "24.02.2026", rate: "42.3369", taxInclusive: "3240.00", payable: "2970.00" },
];

/** Örnek olarak tek başına kullanılan fatura (parser testindeki değerler) */
export const EXAMPLE_INVOICE = SAMPLE_INVOICES[2];

/** Bir örnek tanımından UBL-TR biçiminde XML üretir */
export function syntheticInvoiceXml(inv) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent><Signature>SENTETIK-IMZA-YOK</Signature></ext:ExtensionContent></ext:UBLExtension></ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>TR1.2</cbc:CustomizationID>
  <cbc:ProfileID>TICARIFATURA</cbc:ProfileID>
  <cbc:ID>${inv.docNo}</cbc:ID>
  <cbc:UUID>${inv.uuid}</cbc:UUID>
  <cbc:IssueDate>${inv.issueDate}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>TEVKIFAT</cbc:InvoiceTypeCode>
  <cbc:Note>Sentetik test faturası, gerçek bir işleme ait değildir.</cbc:Note>
  <cbc:Note>Vade Tarihi : ${inv.due}</cbc:Note>
  <cbc:DocumentCurrencyCode>USD</cbc:DocumentCurrencyCode>
  <cac:AdditionalDocumentReference>
    <cbc:ID>${inv.uuid}</cbc:ID>
    <cac:Attachment><cbc:EmbeddedDocumentBinaryObject mimeCode="application/xml" filename="sentetik.xslt">PHhzbDpzdHlsZXNoZWV0Lz4=</cbc:EmbeddedDocumentBinaryObject></cac:Attachment>
  </cac:AdditionalDocumentReference>
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PartyIdentification><cbc:ID schemeID="VKN">${SAMPLE_SUPPLIER.vkn}</cbc:ID></cac:PartyIdentification>
    <cac:PartyIdentification><cbc:ID schemeID="MERSISNO">0000000000000000</cbc:ID></cac:PartyIdentification>
    <cac:PartyName><cbc:Name>${SAMPLE_SUPPLIER.name}</cbc:Name></cac:PartyName>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party>
    <cac:PartyIdentification><cbc:ID schemeID="VKN">${SAMPLE_CUSTOMER.vkn}</cbc:ID></cac:PartyIdentification>
    <cac:PartyName><cbc:Name>${SAMPLE_CUSTOMER.name}</cbc:Name></cac:PartyName>
  </cac:Party></cac:AccountingCustomerParty>
  <cac:PricingExchangeRate>
    <cbc:SourceCurrencyCode>USD</cbc:SourceCurrencyCode>
    <cbc:TargetCurrencyCode>TRY</cbc:TargetCurrencyCode>
    <cbc:CalculationRate>${inv.rate}</cbc:CalculationRate>
  </cac:PricingExchangeRate>
  <cac:LegalMonetaryTotal>
    <cbc:TaxInclusiveAmount currencyID="USD">${inv.taxInclusive}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="USD">${inv.payable}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>
`;
}

/**
 * Kullanıcının yükleyeceği arşivin içeriği: ay klasörlerinde fatura başına bir
 * iç zip, 2025/08 altında açıkta duran mükerrer bir XML ve macOS .DS_Store
 * gürültüsü. Anahtarlar arşiv içindeki yollar, değerler dosya baytlarıdır.
 */
export function sampleArchiveFiles() {
  const files = {};
  SAMPLE_INVOICES.forEach((inv, i) => {
    const inner = zipSync({ [`${inv.uuid}.xml`]: strToU8(syntheticInvoiceXml(inv)) });
    files[`${inv.folder}/${inv.docNo}~${1000000000 + i}.zip`] = inner;
  });
  files[`${EXAMPLE_INVOICE.folder}/${EXAMPLE_INVOICE.uuid}.xml`] = strToU8(syntheticInvoiceXml(EXAMPLE_INVOICE));
  files[`${EXAMPLE_INVOICE.folder}/.DS_Store`] = new Uint8Array([0, 0, 0, 1, 66, 117, 100, 49]);
  return files;
}

/** Arşivin kendisi (dış zip) */
export function sampleArchive() {
  return zipSync(sampleArchiveFiles(), { level: 0 });
}
