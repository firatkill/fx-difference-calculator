import Big from "big.js";
import type { OpeningBalance, ParsedInvoice, Payment } from "@/lib/types";
import { round2 } from "@/lib/money";

/**
 * FIFO + kur farkı hesap motoru (bkz. docs/plan.md bölüm 6).
 *
 * Saf fonksiyon: devir + faturalar + ödemeler → satırlar, mahsuplar, özet.
 * Ödemeler tarih sırasıyla en eski açık faturaya mahsup edilir; artan kısım
 * avans olur ve sonraki faturaları otomatik kapatır. Her mahsup dilimi için:
 *   kur farkı TL = kapatılan USD × (ödeme kuru − fatura kuru)
 */

export type RowKind = "OPENING" | "INVOICE" | "PAYMENT";

export interface Allocation {
  /** Fatura satırının anahtarı (uuid ya da "OPENING") */
  invoiceKey: string;
  invoiceDocNo: string;
  /** Ödeme satırının anahtarı (payment id) */
  paymentKey: string;
  paymentDocNo: string;
  /** Mahsup edilen USD */
  amountFx: string;
  invoiceRate?: string;
  paymentRate: string;
  /** Fatura kuru bilinmiyorsa (kursuz devir) undefined */
  kurFarkiTl?: string;
}

export interface LedgerRow {
  key: string;
  kind: RowKind;
  date: string;
  docNo: string;
  dueDate?: string;
  rate?: string;
  /** Fatura: USD × kur; Ödeme: girilen/hesaplanan TL */
  amountTl?: string;
  amountFx: string;
  /** Fatura satırı: bu faturaya mahsup edilen toplam USD */
  paidFx?: string;
  /** Fatura satırı: kalan açık USD */
  remainingFx?: string;
  /** Ödeme satırı: bilinen dilimlerin toplam kur farkı TL */
  kurFarkiTl?: string;
  /** Bu satırda kuru bilinmeyen dilim var (kur farkı eksik gösterilmeli) */
  hasUnknownRate?: boolean;
  /** Satır sonrası genel bakiye USD (negatif = müşteri alacağı/avans) */
  runningBalanceFx: string;
  /** Bu satırı ilgilendiren mahsup dilimleri */
  allocations: Allocation[];
  note?: string;
  /** Bilgi amaçlı: KDV dahil toplam (fatura) */
  taxInclusiveFx?: string;
}

export interface Summary {
  openingFx?: string;
  totalInvoicedFx: string;
  totalPaidFx: string;
  /** opening + fatura − ödeme; negatifse müşteri alacağı */
  balanceFx: string;
  totalKurFarkiTl: string;
  /** Kursuz devir dilimi nedeniyle kur farkı toplamı eksik */
  hasUnknownKurFarki: boolean;
  invoiceCount: number;
  paymentCount: number;
}

export interface ComputeResult {
  rows: LedgerRow[];
  allocations: Allocation[];
  summary: Summary;
}

export const OPENING_KEY = "OPENING";
export const OPENING_DOC_NO = "DEVİR";

interface OpenSlot {
  row: LedgerRow;
  remaining: Big;
  rate?: Big;
}

interface CreditSlot {
  row: LedgerRow;
  remaining: Big;
  rate: Big;
}

type Event =
  | { kind: "OPENING"; date: string; opening: OpeningBalance }
  | { kind: "INVOICE"; date: string; invoice: ParsedInvoice }
  | { kind: "PAYMENT"; date: string; payment: Payment };

const KIND_ORDER: Record<RowKind, number> = {
  OPENING: 0,
  INVOICE: 1,
  PAYMENT: 2,
};

function compareEvents(a: Event, b: Event): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  if (a.kind === "INVOICE" && b.kind === "INVOICE") {
    return a.invoice.docNo.localeCompare(b.invoice.docNo, "tr");
  }
  if (a.kind === "PAYMENT" && b.kind === "PAYMENT") {
    return a.payment.seq - b.payment.seq;
  }
  return 0;
}

function isPositiveAmount(value: string): boolean {
  try {
    return new Big(value).gt(0);
  } catch {
    return false;
  }
}

export function compute(input: {
  opening?: OpeningBalance | null;
  invoices: ParsedInvoice[];
  payments: Payment[];
}): ComputeResult {
  const events: Event[] = [];

  if (input.opening && isPositiveAmount(input.opening.amountFx)) {
    events.push({
      kind: "OPENING",
      date: input.opening.date,
      opening: input.opening,
    });
  }
  for (const invoice of input.invoices) {
    // Dışlanan (TRY/İADE/kursuz/hatalı) ve geçersiz tutarlı faturalar hesaba girmez
    if (invoice.excluded || !isPositiveAmount(invoice.amountFx)) continue;
    events.push({ kind: "INVOICE", date: invoice.issueDate, invoice });
  }
  for (const payment of input.payments) {
    if (!isPositiveAmount(payment.amountFx)) continue;
    events.push({ kind: "PAYMENT", date: payment.date, payment });
  }

  events.sort(compareEvents);

  const rows: LedgerRow[] = [];
  const allAllocations: Allocation[] = [];
  const openInvoices: OpenSlot[] = [];
  const credits: CreditSlot[] = [];

  let balance = new Big(0);
  let totalInvoiced = new Big(0);
  let totalPaid = new Big(0);
  let totalKurFarki = new Big(0);
  let hasUnknownKurFarki = false;
  let openingFx: string | undefined;
  let invoiceCount = 0;
  let paymentCount = 0;

  /** En eski açık fatura ile verilen krediyi (ödeme/avans) eşleştirir */
  function allocate(slot: OpenSlot, credit: CreditSlot): void {
    const x = slot.remaining.lt(credit.remaining)
      ? slot.remaining
      : credit.remaining;
    if (x.lte(0)) return;

    slot.remaining = slot.remaining.minus(x);
    credit.remaining = credit.remaining.minus(x);

    const allocation: Allocation = {
      invoiceKey: slot.row.key,
      invoiceDocNo: slot.row.docNo,
      paymentKey: credit.row.key,
      paymentDocNo: credit.row.docNo,
      amountFx: round2(x),
      invoiceRate: slot.rate?.toString(),
      paymentRate: credit.rate.toString(),
    };

    if (slot.rate) {
      // dilim kur farkı: kapatılan USD × (ödeme kuru − fatura kuru)
      const diff = x.times(credit.rate.minus(slot.rate));
      allocation.kurFarkiTl = round2(diff);
      totalKurFarki = totalKurFarki.plus(allocation.kurFarkiTl);
      credit.row.kurFarkiTl = round2(
        new Big(credit.row.kurFarkiTl ?? 0).plus(allocation.kurFarkiTl),
      );
    } else {
      hasUnknownKurFarki = true;
      credit.row.hasUnknownRate = true;
    }

    slot.row.paidFx = round2(new Big(slot.row.paidFx ?? 0).plus(x));
    slot.row.remainingFx = round2(slot.remaining);

    slot.row.allocations.push(allocation);
    credit.row.allocations.push(allocation);
    allAllocations.push(allocation);
  }

  /** Yeni açılan faturaya bekleyen avansları (FIFO) mahsup et */
  function drainCreditsInto(slot: OpenSlot): void {
    while (slot.remaining.gt(0) && credits.length > 0) {
      const credit = credits[0];
      allocate(slot, credit);
      if (credit.remaining.lte(0)) credits.shift();
    }
  }

  for (const event of events) {
    if (event.kind === "OPENING") {
      const { opening } = event;
      const amount = new Big(opening.amountFx);
      const rate = opening.rate ? new Big(opening.rate) : undefined;
      const row: LedgerRow = {
        key: OPENING_KEY,
        kind: "OPENING",
        date: opening.date,
        docNo: OPENING_DOC_NO,
        rate: rate?.toString(),
        amountTl:
          opening.amountTl ?? (rate ? round2(amount.times(rate)) : undefined),
        amountFx: round2(amount),
        paidFx: "0.00",
        remainingFx: round2(amount),
        runningBalanceFx: "",
        allocations: [],
      };
      rows.push(row);
      openingFx = row.amountFx;
      balance = balance.plus(amount);
      row.runningBalanceFx = round2(balance);

      const slot: OpenSlot = { row, remaining: amount, rate };
      openInvoices.push(slot);
      drainCreditsInto(slot);
    } else if (event.kind === "INVOICE") {
      const { invoice } = event;
      const amount = new Big(invoice.amountFx);
      const rate = invoice.rate ? new Big(invoice.rate) : undefined;
      const row: LedgerRow = {
        key: invoice.uuid,
        kind: "INVOICE",
        date: invoice.issueDate,
        docNo: invoice.docNo,
        dueDate: invoice.dueDate,
        rate: rate?.toString(),
        amountTl: rate ? round2(amount.times(rate)) : undefined,
        amountFx: round2(amount),
        taxInclusiveFx: invoice.taxInclusiveFx,
        paidFx: "0.00",
        remainingFx: round2(amount),
        runningBalanceFx: "",
        allocations: [],
      };
      rows.push(row);
      invoiceCount++;
      totalInvoiced = totalInvoiced.plus(amount);
      balance = balance.plus(amount);
      row.runningBalanceFx = round2(balance);

      const slot: OpenSlot = { row, remaining: amount, rate };
      openInvoices.push(slot);
      drainCreditsInto(slot);
    } else {
      const { payment } = event;
      const amount = new Big(payment.amountFx);
      const rate = new Big(payment.rate);
      const row: LedgerRow = {
        key: payment.id,
        kind: "PAYMENT",
        date: payment.date,
        docNo: payment.docNo,
        rate: rate.toString(),
        amountTl: payment.amountTl ?? round2(amount.times(rate)),
        amountFx: round2(amount),
        kurFarkiTl: undefined,
        runningBalanceFx: "",
        allocations: [],
        note: payment.note,
      };
      rows.push(row);
      paymentCount++;
      totalPaid = totalPaid.plus(amount);
      balance = balance.minus(amount);
      row.runningBalanceFx = round2(balance);

      const credit: CreditSlot = { row, remaining: amount, rate };
      while (credit.remaining.gt(0) && openInvoices.length > 0) {
        const slot = openInvoices[0];
        allocate(slot, credit);
        if (slot.remaining.lte(0)) openInvoices.shift();
      }
      if (credit.remaining.gt(0)) credits.push(credit);
    }
  }

  return {
    rows,
    allocations: allAllocations,
    summary: {
      openingFx,
      totalInvoicedFx: round2(totalInvoiced),
      totalPaidFx: round2(totalPaid),
      balanceFx: round2(balance),
      totalKurFarkiTl: round2(totalKurFarki),
      hasUnknownKurFarki,
      invoiceCount,
      paymentCount,
    },
  };
}
