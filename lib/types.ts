/**
 * Ortak veri modelleri (bkz. docs/plan-platform.md bölüm 5).
 * Tüm parasal tutarlar kayan nokta hatasından kaçınmak için
 * nokta ondalıklı string olarak taşınır ve big.js ile işlenir.
 * Supabase (Postgres) satırlarıyla eşlemesi lib/supabase/repo.ts'tedir.
 */

export type ExcludeReason = "NON_USD" | "IADE" | "NO_RATE" | "PARSE_ERROR";

export interface Invoice {
  /** UBL UUID — mükerrer kontrolünde birincil anahtar */
  uuid: string;
  customerId: string;
  userId: string;
  /** Belge no, örn. ORN2025000001638 */
  docNo: string;
  /** ISO tarih: YYYY-MM-DD */
  issueDate: string;
  /** Vade tarihi (nottan), ISO */
  dueDate?: string;
  /** DocumentCurrencyCode; 'USD' değilse excluded */
  currency: string;
  /** Faturadaki kur (USD→TRY), örn. "40.6467" */
  rate?: string;
  /** PayableAmount — müşterinin satıcıya borçlandığı döviz tutarı */
  amountFx: string;
  /** KDV dahil toplam (bilgi amaçlı) */
  taxInclusiveFx?: string;
  supplierName?: string;
  customerVkn: string;
  customerName: string;
  /** SATIS | TEVKIFAT | IADE | ... */
  invoiceType: string;
  /** Doluysa fatura hesaba katılmaz */
  excluded?: { reason: ExcludeReason; detail?: string };
  /** Zip içindeki kaynak yolu (izlenebilirlik) */
  sourcePath: string;
}

/** Parser çıktısı: henüz bir müşteriye atanmamış fatura */
export type ParsedInvoice = Omit<Invoice, "customerId" | "userId">;

export interface Payment {
  id: string;
  customerId: string;
  userId: string;
  /** Otomatik belge no: ÖD-0001 */
  docNo: string;
  /** ISO tarih */
  date: string;
  /** Aynı tarihli ödemelerin giriş sırası */
  seq: number;
  /** Kullanıcının giriş cinsi */
  entryMode: "TL" | "USD";
  /** TL girildiyse girilen tutar */
  amountTl?: string;
  /** USD karşılığı (TL girildiyse amountTl / rate) */
  amountFx: string;
  /** Ödeme günü kuru (zorunlu) */
  rate: string;
  note?: string;
}

export interface OpeningBalance {
  /** FIFO'da her şeyden önce işlenir */
  date: string;
  entryMode: "TL" | "USD";
  amountFx: string;
  /** TL girildiyse girilen tutar */
  amountTl?: string;
  /** Opsiyonel; yoksa bu dilime kur farkı hesaplanmaz */
  rate?: string;
}

/** Bir kullanıcının takip ettiği müşteri cari defteri (eski adıyla "Workspace") */
export interface Customer {
  id: string;
  userId: string;
  customerVkn: string;
  customerName: string;
  supplierName?: string;
  openingBalance?: OpeningBalance;
  /** ÖD-#### üretimi için sayaç */
  paymentCounter: number;
  createdAt: number;
  updatedAt: number;
}
