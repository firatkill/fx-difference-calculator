import { XMLParser } from "fast-xml-parser";
import Big from "big.js";
import type { ParsedInvoice } from "@/lib/types";

/**
 * UBL-TR e-Fatura XML'inden uygulama modelini çıkarır.
 * Alan eşlemesi için bkz. docs/plan.md bölüm 4.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false, // tutarlar string kalsın (float hatası olmasın)
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => name === "Note" || name === "PartyIdentification",
});

/** İmza ve gömülü ek (base64) blokları hem hız hem çakışma riski için ayıklanır */
function stripHeavyBlocks(xml: string): string {
  return xml
    .replace(/<ext:UBLExtensions>[\s\S]*?<\/ext:UBLExtensions>/, "")
    .replace(
      /<cbc:EmbeddedDocumentBinaryObject[\s\S]*?<\/cbc:EmbeddedDocumentBinaryObject>/g,
      "",
    );
}

/** Düz string, sayı veya {'#text': ...} düğümünden metni çeker */
function text(node: unknown): string | undefined {
  if (node == null) return undefined;
  if (typeof node === "string") return node || undefined;
  if (typeof node === "number") return String(node);
  if (typeof node === "object" && "#text" in (node as Record<string, unknown>)) {
    return text((node as Record<string, unknown>)["#text"]);
  }
  return undefined;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/** "40,6467" veya "40.6467" → "40.6467"; geçersizse undefined */
function normalizeDecimal(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return undefined;
  try {
    return new Big(s).toString();
  } catch {
    return undefined;
  }
}

interface PartyInfo {
  id?: string;
  name?: string;
}

function readParty(partyContainer: unknown): PartyInfo {
  const party = (partyContainer as Record<string, unknown> | undefined)?.[
    "Party"
  ] as Record<string, unknown> | undefined;
  if (!party) return {};

  let id: string | undefined;
  for (const pid of asArray(party["PartyIdentification"])) {
    const node = (pid as Record<string, unknown>)["ID"];
    const scheme = (node as Record<string, unknown> | undefined)?.["@_schemeID"];
    const value = text(node);
    if (!value) continue;
    // VKN/TCKN öncelikli; şema belirtilmemişse ilk değeri al
    if (scheme === "VKN" || scheme === "TCKN") {
      id = value;
      break;
    }
    id ??= value;
  }

  const name = text(
    (party["PartyName"] as Record<string, unknown> | undefined)?.["Name"],
  );
  return { id, name };
}

/** Notlardan "Vade Tarihi : 29.11.2025" → "2025-11-29" */
function readDueDate(notes: string[]): string | undefined {
  for (const note of notes) {
    const m = note.match(/Vade\s*Tarihi\s*:?\s*(\d{2})\.(\d{2})\.(\d{4})/i);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }
  return undefined;
}

/** Notlardan "Döviz Kuru:40,6467" → "40.6467" */
function readRateFromNotes(notes: string[]): string | undefined {
  for (const note of notes) {
    const m = note.match(/D[öo]viz\s*Kuru\s*:?\s*([\d.,]+)/i);
    if (m) return normalizeDecimal(m[1]);
  }
  return undefined;
}

export function parseUblInvoice(
  xmlText: string,
  sourcePath: string,
): ParsedInvoice {
  try {
    const doc = parser.parse(stripHeavyBlocks(xmlText));
    const inv = doc["Invoice"] as Record<string, unknown> | undefined;
    if (!inv) throw new Error("Invoice kök elemanı bulunamadı");

    const uuid = text(inv["UUID"]);
    const docNo = text(inv["ID"]);
    const issueDate = text(inv["IssueDate"]);
    if (!uuid || !docNo || !issueDate) {
      throw new Error("Zorunlu alan eksik (UUID / ID / IssueDate)");
    }

    const notes = asArray(inv["Note"])
      .map((n) => text(n))
      .filter((n): n is string => !!n);

    const currency = text(inv["DocumentCurrencyCode"]) ?? "";
    const invoiceType = text(inv["InvoiceTypeCode"]) ?? "";

    const exchangeRate = normalizeDecimal(
      text(
        (inv["PricingExchangeRate"] as Record<string, unknown> | undefined)?.[
          "CalculationRate"
        ],
      ),
    );
    const rate = exchangeRate ?? readRateFromNotes(notes);

    const totals = inv["LegalMonetaryTotal"] as
      | Record<string, unknown>
      | undefined;
    const amountFx = normalizeDecimal(text(totals?.["PayableAmount"]));
    const taxInclusiveFx = normalizeDecimal(
      text(totals?.["TaxInclusiveAmount"]),
    );
    if (!amountFx) throw new Error("PayableAmount okunamadı");

    const customer = readParty(inv["AccountingCustomerParty"]);
    const supplier = readParty(inv["AccountingSupplierParty"]);
    if (!customer.id) throw new Error("Müşteri VKN/TCKN okunamadı");

    const base: ParsedInvoice = {
      uuid,
      docNo,
      issueDate,
      dueDate: readDueDate(notes),
      currency,
      rate,
      amountFx,
      taxInclusiveFx,
      supplierName: supplier.name,
      customerVkn: customer.id,
      customerName: customer.name ?? "(bilinmeyen müşteri)",
      invoiceType,
      sourcePath,
    };

    if (invoiceType.toUpperCase() === "IADE") {
      return { ...base, excluded: { reason: "IADE" } };
    }
    if (currency !== "USD") {
      return {
        ...base,
        excluded: { reason: "NON_USD", detail: currency || "belirsiz" },
      };
    }
    if (!rate) {
      return { ...base, excluded: { reason: "NO_RATE" } };
    }
    return base;
  } catch (err) {
    // Kritik alanlar okunamadı: yine de listede gösterilebilecek bir kayıt üret
    return {
      uuid: `parse-error:${sourcePath}`,
      docNo: sourcePath.split("!/").pop() ?? sourcePath,
      issueDate: "",
      currency: "",
      amountFx: "0",
      customerVkn: "",
      customerName: "(okunamadı)",
      invoiceType: "",
      sourcePath,
      excluded: {
        reason: "PARSE_ERROR",
        detail: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/** Birden çok XML'i parse eder, UUID mükerrerlerini ayıklar */
export interface ParseBatchResult {
  invoices: ParsedInvoice[];
  duplicateCount: number;
}

export function parseInvoiceBatch(
  xmls: { path: string; text: string }[],
): ParseBatchResult {
  const seen = new Set<string>();
  const invoices: ParsedInvoice[] = [];
  let duplicateCount = 0;

  for (const { path, text: xmlText } of xmls) {
    const parsed = parseUblInvoice(xmlText, path);
    if (seen.has(parsed.uuid)) {
      duplicateCount++;
      continue;
    }
    seen.add(parsed.uuid);
    invoices.push(parsed);
  }
  return { invoices, duplicateCount };
}
