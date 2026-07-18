import { describe, expect, it } from "vitest";
import { compute, OPENING_KEY } from "@/lib/engine/fifo";
import type { OpeningBalance, ParsedInvoice, Payment } from "@/lib/types";

/** Test yardımcıları */
let uuidSeq = 0;
function inv(over: Partial<ParsedInvoice> = {}): ParsedInvoice {
  uuidSeq++;
  return {
    uuid: `inv-${uuidSeq}`,
    docNo: `F-${String(uuidSeq).padStart(3, "0")}`,
    issueDate: "2025-01-10",
    currency: "USD",
    rate: "5",
    amountFx: "2000",
    customerVkn: "1",
    customerName: "Test",
    invoiceType: "SATIS",
    sourcePath: "t",
    ...over,
  };
}

let paySeq = 0;
function pay(over: Partial<Payment> = {}): Payment {
  paySeq++;
  return {
    id: `pay-${paySeq}`,
    workspaceId: "w",
    docNo: `ÖD-${String(paySeq).padStart(4, "0")}`,
    date: "2025-06-01",
    seq: paySeq,
    entryMode: "USD",
    amountFx: "1000",
    rate: "10",
    ...over,
  };
}

describe("compute — kullanıcının doğrulama senaryosu", () => {
  it("2.000 USD fatura @5, 10.000 TL ödeme @10 → kalan 1.000 USD, kur farkı 5.000 TL", () => {
    const invoice = inv({ rate: "5", amountFx: "2000" });
    const payment = pay({
      entryMode: "TL",
      amountTl: "10000",
      amountFx: "1000", // 10000 / 10
      rate: "10",
    });

    const { rows, summary } = compute({
      invoices: [invoice],
      payments: [payment],
    });

    expect(summary.balanceFx).toBe("1000.00");
    expect(summary.totalKurFarkiTl).toBe("5000.00");

    const invRow = rows.find((r) => r.kind === "INVOICE")!;
    expect(invRow.amountTl).toBe("10000.00");
    expect(invRow.paidFx).toBe("1000.00");
    expect(invRow.remainingFx).toBe("1000.00");

    const payRow = rows.find((r) => r.kind === "PAYMENT")!;
    expect(payRow.amountTl).toBe("10000");
    expect(payRow.kurFarkiTl).toBe("5000.00");
    expect(payRow.runningBalanceFx).toBe("1000.00");
    expect(payRow.allocations).toHaveLength(1);
    expect(payRow.allocations[0].amountFx).toBe("1000.00");
  });
});

describe("compute — FIFO mahsup", () => {
  it("ödeme birden çok faturaya taşar (90k + 10k örneği)", () => {
    const inv1 = inv({ issueDate: "2025-01-01", amountFx: "90000", rate: "40" });
    const inv2 = inv({ issueDate: "2025-02-01", amountFx: "20000", rate: "41" });
    const payment = pay({ amountFx: "100000", rate: "42", date: "2025-03-01" });

    const { rows, summary } = compute({
      invoices: [inv2, inv1], // sırasız verilse de tarihle sıralanmalı
      payments: [payment],
    });

    const [r1, r2, rp] = rows;
    expect(r1.docNo).toBe(inv1.docNo);
    expect(r1.remainingFx).toBe("0.00"); // tamamen kapandı
    expect(r2.paidFx).toBe("10000.00");
    expect(r2.remainingFx).toBe("10000.00");
    expect(summary.balanceFx).toBe("10000.00");
    // kur farkı: 90000×(42−40) + 10000×(42−41) = 180000 + 10000
    expect(rp.kurFarkiTl).toBe("190000.00");
    expect(summary.totalKurFarkiTl).toBe("190000.00");
  });

  it("ödemeler sırayla: ikinci ödeme kaldığı yerden devam eder", () => {
    const invoice = inv({ amountFx: "1000", rate: "40" });
    const p1 = pay({ amountFx: "400", rate: "41", date: "2025-02-01" });
    const p2 = pay({ amountFx: "600", rate: "42", date: "2025-03-01" });

    const { rows, summary } = compute({
      invoices: [invoice],
      payments: [p1, p2],
    });

    const invRow = rows[0];
    expect(invRow.remainingFx).toBe("0.00");
    expect(invRow.allocations).toHaveLength(2);
    expect(summary.balanceFx).toBe("0.00");
    // 400×1 + 600×2 = 1600
    expect(summary.totalKurFarkiTl).toBe("1600.00");
  });
});

describe("compute — avans (fazla ödeme)", () => {
  it("açık borçtan fazla ödeme avansta bekler, sonraki faturayı otomatik kapatır", () => {
    const inv1 = inv({ issueDate: "2025-01-01", amountFx: "500", rate: "40" });
    const payment = pay({ amountFx: "800", rate: "41", date: "2025-02-01" });
    const inv2 = inv({ issueDate: "2025-03-01", amountFx: "1000", rate: "43" });

    const { rows, summary } = compute({
      invoices: [inv1, inv2],
      payments: [payment],
    });

    const payRow = rows.find((r) => r.kind === "PAYMENT")!;
    // ödeme anında bakiye negatif (avans)
    expect(payRow.runningBalanceFx).toBe("-300.00");

    const inv2Row = rows.find((r) => r.docNo === inv2.docNo)!;
    expect(inv2Row.paidFx).toBe("300.00");
    expect(inv2Row.remainingFx).toBe("700.00");
    expect(summary.balanceFx).toBe("700.00");

    // kur farkı: 500×(41−40) + 300×(41−43) = 500 − 600 = −100
    expect(summary.totalKurFarkiTl).toBe("-100.00");
    expect(payRow.kurFarkiTl).toBe("-100.00");
  });

  it("hiç fatura yokken ödeme tamamen avans kalır", () => {
    const payment = pay({ amountFx: "800", rate: "41" });
    const { rows, summary } = compute({ invoices: [], payments: [payment] });
    expect(summary.balanceFx).toBe("-800.00");
    expect(rows[0].allocations).toHaveLength(0);
    expect(summary.totalKurFarkiTl).toBe("0.00");
  });
});

describe("compute — devir bakiyesi", () => {
  it("devir en başta kapatılır; kurlu devir kur farkına girer", () => {
    const opening: OpeningBalance = {
      date: "2024-12-31",
      entryMode: "TL",
      amountFx: "1000",
      amountTl: "35000",
      rate: "35",
    };
    const invoice = inv({ issueDate: "2025-01-10", amountFx: "500", rate: "40" });
    const payment = pay({ amountFx: "1200", rate: "42", date: "2025-02-01" });

    const { rows, summary } = compute({
      opening,
      invoices: [invoice],
      payments: [payment],
    });

    expect(rows[0].key).toBe(OPENING_KEY);
    expect(rows[0].remainingFx).toBe("0.00"); // devir tamamen kapandı
    const invRow = rows.find((r) => r.kind === "INVOICE")!;
    expect(invRow.paidFx).toBe("200.00");
    // 1000×(42−35) + 200×(42−40) = 7000 + 400
    expect(summary.totalKurFarkiTl).toBe("7400.00");
    expect(summary.openingFx).toBe("1000.00");
    // toplam fatura devri içermez
    expect(summary.totalInvoicedFx).toBe("500.00");
    expect(summary.balanceFx).toBe("300.00");
  });

  it("kursuz devirde o dilimin kur farkı hesaplanmaz, bayrak kalkar", () => {
    const opening: OpeningBalance = {
      date: "2024-12-31",
      entryMode: "USD",
      amountFx: "1000",
    };
    const payment = pay({ amountFx: "400", rate: "42", date: "2025-01-15" });

    const { rows, summary } = compute({
      opening,
      invoices: [],
      payments: [payment],
    });

    const payRow = rows.find((r) => r.kind === "PAYMENT")!;
    expect(payRow.hasUnknownRate).toBe(true);
    expect(payRow.allocations[0].kurFarkiTl).toBeUndefined();
    expect(summary.hasUnknownKurFarki).toBe(true);
    expect(summary.totalKurFarkiTl).toBe("0.00");
    expect(summary.balanceFx).toBe("600.00");
  });
});

describe("compute — sıralama kuralları", () => {
  it("aynı gün: önce fatura, sonra ödeme (ödeme o günün faturasını kapatabilir)", () => {
    const invoice = inv({ issueDate: "2025-05-05", amountFx: "100", rate: "40" });
    const payment = pay({ amountFx: "100", rate: "40", date: "2025-05-05" });

    const { rows, summary } = compute({
      invoices: [invoice],
      payments: [payment],
    });

    expect(rows[0].kind).toBe("INVOICE");
    expect(rows[1].kind).toBe("PAYMENT");
    expect(summary.balanceFx).toBe("0.00");
    expect(rows[0].remainingFx).toBe("0.00");
  });

  it("aynı gün faturalar belge numarasına göre sıralanır", () => {
    const a = inv({ issueDate: "2025-05-05", docNo: "ORN2025000000002" });
    const b = inv({ issueDate: "2025-05-05", docNo: "ORN2025000000001" });
    const { rows } = compute({ invoices: [a, b], payments: [] });
    expect(rows[0].docNo).toBe("ORN2025000000001");
  });

  it("aynı gün ödemeler giriş sırasına (seq) göre işlenir", () => {
    const invoice = inv({ amountFx: "100", rate: "40" });
    const p1 = pay({ amountFx: "60", rate: "41", date: "2025-06-01", seq: 1 });
    const p2 = pay({ amountFx: "60", rate: "45", date: "2025-06-01", seq: 2 });

    const { rows } = compute({ invoices: [invoice], payments: [p2, p1] });
    const invRow = rows[0];
    // ilk 60 p1'den (kur 41), kalan 40 p2'den (kur 45)
    expect(invRow.allocations[0].paymentRate).toBe("41");
    expect(invRow.allocations[0].amountFx).toBe("60.00");
    expect(invRow.allocations[1].paymentRate).toBe("45");
    expect(invRow.allocations[1].amountFx).toBe("40.00");
  });
});

describe("compute — yuvarlama ve geçersiz girdiler", () => {
  it("kuruşlu üç ödeme faturayı artıksız kapatır", () => {
    const invoice = inv({ amountFx: "100.00", rate: "40.1234" });
    const p1 = pay({ amountFx: "33.33", rate: "40.5", date: "2025-02-01" });
    const p2 = pay({ amountFx: "33.33", rate: "40.6", date: "2025-02-02" });
    const p3 = pay({ amountFx: "33.34", rate: "40.7", date: "2025-02-03" });

    const { rows, summary } = compute({
      invoices: [invoice],
      payments: [p1, p2, p3],
    });

    expect(rows[0].remainingFx).toBe("0.00");
    expect(summary.balanceFx).toBe("0.00");
    // satır kur farkları özet toplamıyla birebir aynı olmalı
    const rowSum = rows
      .filter((r) => r.kind === "PAYMENT")
      .reduce((acc, r) => acc + Number(r.kurFarkiTl ?? 0), 0);
    expect(rowSum.toFixed(2)).toBe(summary.totalKurFarkiTl);
  });

  it("dışlanan faturalar ve sıfır/negatif tutarlar hesaba girmez", () => {
    const good = inv({ amountFx: "100" });
    const excluded = inv({
      amountFx: "999",
      excluded: { reason: "NON_USD", detail: "TRY" },
    });
    const zero = inv({ amountFx: "0" });
    const badPay = pay({ amountFx: "0" });

    const { rows, summary } = compute({
      invoices: [good, excluded, zero],
      payments: [badPay],
    });

    expect(rows).toHaveLength(1);
    expect(summary.totalInvoicedFx).toBe("100.00");
    expect(summary.paymentCount).toBe(0);
  });

  it("kur düşerse kur farkı negatif çıkar", () => {
    const invoice = inv({ amountFx: "1000", rate: "45" });
    const payment = pay({ amountFx: "1000", rate: "42" });
    const { summary } = compute({ invoices: [invoice], payments: [payment] });
    expect(summary.totalKurFarkiTl).toBe("-3000.00");
  });
});
