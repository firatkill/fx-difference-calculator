import type { ComputeResult, LedgerRow } from "@/lib/engine/fifo";
import type { Workspace } from "@/lib/types";

/**
 * Cari hesap + mahsup detayını iki sayfalı .xlsx olarak üretir.
 * exceljs bundle'ı büyük olduğundan dinamik import edilir.
 */

const GREEN_FILL = "FFC6EFCE"; // ödeme satırları
const SKY_FILL = "FFDDEBF7"; // devir satırı
const HEADER_FILL = "FFE2E8F0";

const MONEY_FMT = "#,##0.00";
const RATE_FMT = "#,##0.0000";
const DATE_FMT = "dd.mm.yyyy";

function kindLabel(kind: LedgerRow["kind"]): string {
  return kind === "PAYMENT" ? "Ödeme" : kind === "OPENING" ? "Devir" : "Fatura";
}

function toDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  return new Date(`${iso}T12:00:00`);
}

function num(value: string | undefined): number | undefined {
  return value == null ? undefined : Number(value);
}

export async function buildWorkbookBlob(
  workspace: Workspace,
  result: ComputeResult,
): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  // ── Sayfa 1: Cari Hesap ────────────────────────────────────────────
  const ws = wb.addWorksheet("Cari Hesap");

  ws.addRow([workspace.customerName]).font = { bold: true, size: 14 };
  ws.addRow([`VKN: ${workspace.customerVkn}`]);
  if (workspace.supplierName) ws.addRow([`Satıcı: ${workspace.supplierName}`]);
  const reportDateRow = ws.addRow([
    `Rapor tarihi: ${new Date().toLocaleDateString("tr-TR")}`,
  ]);
  reportDateRow.font = { color: { argb: "FF64748B" } };
  ws.addRow([]);

  const header = ws.addRow([
    "Tarih",
    "Tip",
    "Belge No",
    "Vade",
    "Kur",
    "TL Tutar",
    "Döviz Tutar (USD)",
    "Ödenen (USD)",
    "Kalan (USD)",
    "Kur Farkı (TL)",
    "Bakiye (USD)",
    "Açıklama",
  ]);
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL },
    };
    cell.border = { bottom: { style: "thin" } };
  });

  for (const row of result.rows) {
    const isPayment = row.kind === "PAYMENT";
    const excelRow = ws.addRow([
      toDate(row.date),
      kindLabel(row.kind),
      row.docNo,
      toDate(row.dueDate),
      num(row.rate),
      num(row.amountTl),
      num(row.amountFx),
      !isPayment ? num(row.paidFx) : undefined,
      !isPayment ? num(row.remainingFx) : undefined,
      isPayment ? num(row.kurFarkiTl) : undefined,
      num(row.runningBalanceFx),
      [
        row.note,
        row.hasUnknownRate ? "kursuz devir dilimi: kur farkı eksik" : undefined,
      ]
        .filter(Boolean)
        .join(" · ") || undefined,
    ]);

    excelRow.getCell(1).numFmt = DATE_FMT;
    excelRow.getCell(4).numFmt = DATE_FMT;
    excelRow.getCell(5).numFmt = RATE_FMT;
    for (const col of [6, 7, 8, 9, 10, 11]) {
      excelRow.getCell(col).numFmt = MONEY_FMT;
    }

    if (isPayment || row.kind === "OPENING") {
      const fill = isPayment ? GREEN_FILL : SKY_FILL;
      excelRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: fill },
        };
      });
    }
  }

  ws.addRow([]);
  const s = result.summary;
  const summaryRows: [string, number | string, string?][] = [
    ["Devir", s.openingFx ? Number(s.openingFx) : "—"],
    [`Toplam Fatura (${s.invoiceCount} adet)`, Number(s.totalInvoicedFx)],
    [`Toplam Ödeme (${s.paymentCount} adet)`, Number(s.totalPaidFx)],
    [
      Number(s.balanceFx) < 0 ? "Müşteri Alacağı (Avans)" : "Kalan Bakiye",
      Math.abs(Number(s.balanceFx)),
    ],
    [
      "Toplam Kur Farkı (TL)",
      Number(s.totalKurFarkiTl),
      s.hasUnknownKurFarki ? "kursuz devir dilimi hariç (eksik)" : undefined,
    ],
  ];
  for (const [label, value, note] of summaryRows) {
    const r = ws.addRow([label, "", "", "", "", value, note ?? ""]);
    r.getCell(1).font = { bold: true };
    r.getCell(6).font = { bold: true };
    if (typeof value === "number") r.getCell(6).numFmt = MONEY_FMT;
  }

  ws.columns = [
    { width: 12 },
    { width: 8 },
    { width: 20 },
    { width: 12 },
    { width: 10 },
    { width: 14 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 30 },
  ];
  ws.views = [{ state: "frozen", ySplit: header.number }];

  // ── Sayfa 2: Mahsup Detayı ─────────────────────────────────────────
  const ws2 = wb.addWorksheet("Mahsup Detayı");
  const rowByKey = new Map(result.rows.map((r) => [r.key, r]));

  const header2 = ws2.addRow([
    "Ödeme No",
    "Ödeme Tarihi",
    "Kapatılan Belge",
    "Belge Tarihi",
    "Mahsup (USD)",
    "Fatura Kuru",
    "Ödeme Kuru",
    "Kur Farkı (TL)",
  ]);
  header2.font = { bold: true };
  header2.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL },
    };
    cell.border = { bottom: { style: "thin" } };
  });

  for (const a of result.allocations) {
    const paymentRow = rowByKey.get(a.paymentKey);
    const invoiceRow = rowByKey.get(a.invoiceKey);
    const r = ws2.addRow([
      a.paymentDocNo,
      toDate(paymentRow?.date),
      a.invoiceDocNo,
      toDate(invoiceRow?.date),
      Number(a.amountFx),
      a.invoiceRate ? Number(a.invoiceRate) : "bilinmiyor",
      Number(a.paymentRate),
      a.kurFarkiTl != null ? Number(a.kurFarkiTl) : "—",
    ]);
    r.getCell(2).numFmt = DATE_FMT;
    r.getCell(4).numFmt = DATE_FMT;
    r.getCell(5).numFmt = MONEY_FMT;
    r.getCell(6).numFmt = RATE_FMT;
    r.getCell(7).numFmt = RATE_FMT;
    r.getCell(8).numFmt = MONEY_FMT;
  }

  ws2.columns = [
    { width: 12 },
    { width: 13 },
    { width: 20 },
    { width: 13 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
  ];

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** "ÖRNEK MÜŞTERİ SAN..." → "ORNEK-MUSTERI-SAN" (dosya adı için) */
function slugify(name: string): string {
  const map: Record<string, string> = {
    ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I",
    ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U",
  };
  return name
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch) => map[ch] ?? ch)
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function downloadWorkbook(
  workspace: Workspace,
  result: ComputeResult,
): Promise<void> {
  const blob = await buildWorkbookBlob(workspace, result);
  const today = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kur-farki_${slugify(workspace.customerName)}_${today}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
