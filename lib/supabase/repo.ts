import { createClient } from "@/lib/supabase/client";
import type {
  Customer,
  ExcludeReason,
  Invoice,
  OpeningBalance,
  ParsedInvoice,
  Payment,
} from "@/lib/types";
import { round2 } from "@/lib/money";
import Big from "big.js";

/**
 * Supabase (Postgres) veri erişim katmanı — eski Dexie repo'sunun karşılığı
 * (bkz. docs/plan-platform.md bölüm 5, 7). Satır (snake_case) ↔ tip
 * (camelCase) eşlemesi burada yapılır. RLS her sorguda `user_id = auth.uid()`
 * zorunluluğunu sunucu tarafında uygular; burada ayrıca kullanıcı süzmeye
 * gerek yoktur.
 */

// ── Satır eşlemeleri ────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function s(row: Row, key: string): string {
  return row[key] as string;
}
function opt(row: Row, key: string): string | undefined {
  const v = row[key];
  return v == null ? undefined : (v as string);
}

function rowToCustomer(row: Row): Customer {
  return {
    id: s(row, "id"),
    userId: s(row, "user_id"),
    customerVkn: s(row, "customer_vkn"),
    customerName: s(row, "customer_name"),
    supplierName: opt(row, "supplier_name"),
    openingBalance: (row.opening_balance as OpeningBalance | null) ?? undefined,
    paymentCounter: Number(row.payment_counter),
    createdAt: new Date(s(row, "created_at")).getTime(),
    updatedAt: new Date(s(row, "updated_at")).getTime(),
  };
}

function rowToInvoice(row: Row): Invoice {
  const reason = opt(row, "excluded_reason");
  return {
    uuid: s(row, "uuid"),
    customerId: s(row, "customer_id"),
    userId: s(row, "user_id"),
    docNo: s(row, "doc_no"),
    issueDate: s(row, "issue_date"),
    dueDate: opt(row, "due_date"),
    currency: s(row, "currency"),
    rate: opt(row, "rate"),
    amountFx: s(row, "amount_fx"),
    taxInclusiveFx: opt(row, "tax_inclusive_fx"),
    supplierName: opt(row, "supplier_name"),
    customerVkn: s(row, "customer_vkn"),
    customerName: s(row, "customer_name"),
    invoiceType: s(row, "invoice_type"),
    excluded: reason
      ? { reason: reason as ExcludeReason, detail: opt(row, "excluded_detail") }
      : undefined,
    sourcePath: s(row, "source_path"),
  };
}

function rowToPayment(row: Row): Payment {
  return {
    id: s(row, "id"),
    customerId: s(row, "customer_id"),
    userId: s(row, "user_id"),
    docNo: s(row, "doc_no"),
    date: s(row, "date"),
    seq: Number(row.seq),
    entryMode: s(row, "entry_mode") as Payment["entryMode"],
    amountTl: opt(row, "amount_tl"),
    amountFx: s(row, "amount_fx"),
    rate: s(row, "rate"),
    note: opt(row, "note"),
  };
}

function invoiceToRow(inv: ParsedInvoice, customerId: string, userId: string): Row {
  return {
    uuid: inv.uuid,
    customer_id: customerId,
    user_id: userId,
    doc_no: inv.docNo,
    issue_date: inv.issueDate,
    due_date: inv.dueDate ?? null,
    currency: inv.currency,
    rate: inv.rate ?? null,
    amount_fx: inv.amountFx,
    tax_inclusive_fx: inv.taxInclusiveFx ?? null,
    supplier_name: inv.supplierName ?? null,
    customer_vkn: inv.customerVkn,
    customer_name: inv.customerName,
    invoice_type: inv.invoiceType,
    excluded_reason: inv.excluded?.reason ?? null,
    excluded_detail: inv.excluded?.detail ?? null,
    source_path: inv.sourcePath,
  };
}

async function currentUserId(
  supabase: ReturnType<typeof createClient>,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Oturum bulunamadı, lütfen tekrar giriş yapın.");
  return user.id;
}

// ── Müşteri listesi ──────────────────────────────────────────────────────────

export interface CustomerListItem extends Customer {
  invoiceCount: number;
  paymentCount: number;
}

export async function listCustomers(): Promise<CustomerListItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  return Promise.all(
    (data ?? []).map(async (row: Row) => {
      const customer = rowToCustomer(row);
      const [invoiceCount, paymentCount] = await Promise.all([
        countRows(supabase, "invoices", customer.id),
        countRows(supabase, "payments", customer.id),
      ]);
      return { ...customer, invoiceCount, paymentCount };
    }),
  );
}

async function countRows(
  supabase: ReturnType<typeof createClient>,
  table: "invoices" | "payments",
  customerId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("customer_id", customerId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToCustomer(data) : null;
}

export async function listInvoices(customerId: string): Promise<Invoice[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("customer_id", customerId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToInvoice);
}

export async function listPayments(customerId: string): Promise<Payment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("customer_id", customerId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToPayment);
}

// ── İçe aktarma (zip → müşteri + faturalar) ─────────────────────────────────

export interface ImportIntoCustomerResult {
  customerId: string;
  addedCount: number;
  alreadyExistingCount: number;
}

export async function importIntoCustomer(group: {
  vkn: string;
  name: string;
  supplierName?: string;
  invoices: ParsedInvoice[];
}): Promise<ImportIntoCustomerResult> {
  const supabase = createClient();
  const userId = await currentUserId(supabase);

  const { data: customerRow, error: upsertError } = await supabase
    .from("customers")
    .upsert(
      {
        user_id: userId,
        customer_vkn: group.vkn,
        customer_name: group.name,
        supplier_name: group.supplierName ?? null,
      },
      { onConflict: "user_id,customer_vkn" },
    )
    .select()
    .single();
  if (upsertError) throw new Error(upsertError.message);
  const customer = rowToCustomer(customerRow);

  const uuids = group.invoices.map((i) => i.uuid);
  const existingSet = new Set<string>();
  // Postgres IN listesi için makul dilimlerde sorgula (yüzlerce fatura için yeterli)
  const CHUNK = 500;
  for (let i = 0; i < uuids.length; i += CHUNK) {
    const chunk = uuids.slice(i, i + CHUNK);
    if (chunk.length === 0) continue;
    const { data: existingRows, error: existingError } = await supabase
      .from("invoices")
      .select("uuid")
      .in("uuid", chunk);
    if (existingError) throw new Error(existingError.message);
    for (const row of existingRows ?? []) existingSet.add(row.uuid as string);
  }

  const toInsert = group.invoices
    .filter((inv) => !existingSet.has(inv.uuid))
    .map((inv) => invoiceToRow(inv, customer.id, userId));

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("invoices")
      .insert(toInsert);
    if (insertError) throw new Error(insertError.message);
  }

  return {
    customerId: customer.id,
    addedCount: toInsert.length,
    alreadyExistingCount: existingSet.size,
  };
}

/** Zip'siz, manuel müşteri oluşturma ("Yeni Müşteri" formu) */
export async function createCustomer(input: {
  vkn: string;
  name: string;
  supplierName?: string;
}): Promise<Customer> {
  const supabase = createClient();
  const userId = await currentUserId(supabase);

  const { data, error } = await supabase
    .from("customers")
    .insert({
      user_id: userId,
      customer_vkn: input.vkn,
      customer_name: input.name,
      supplier_name: input.supplierName ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(`Bu VKN (${input.vkn}) ile zaten bir müşteri kayıtlı.`);
    }
    throw new Error(error.message);
  }
  return rowToCustomer(data);
}

export async function deleteCustomer(id: string): Promise<void> {
  const supabase = createClient();
  // invoices/payments FK "on delete cascade" ile otomatik silinir
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Ödemeler ─────────────────────────────────────────────────────────────────

export interface PaymentInput {
  date: string;
  entryMode: "TL" | "USD";
  amountTl?: string;
  amountFx: string;
  rate: string;
  note?: string;
}

/** ÖD-#### numarasını yarış durumu olmadan atayan add_payment RPC'sini çağırır */
export async function addPayment(
  customerId: string,
  input: PaymentInput,
): Promise<Payment> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("add_payment", {
    p_customer_id: customerId,
    p_date: input.date,
    p_entry_mode: input.entryMode,
    p_amount_tl: input.amountTl ? round2(new Big(input.amountTl)) : null,
    p_amount_fx: round2(new Big(input.amountFx)),
    p_rate: input.rate,
    p_note: input.note ?? null,
  });
  if (error) throw new Error(error.message);
  return rowToPayment(data as Row);
}

export async function updatePayment(
  id: string,
  input: PaymentInput,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("payments")
    .update({
      date: input.date,
      entry_mode: input.entryMode,
      amount_tl: input.amountTl ? round2(new Big(input.amountTl)) : null,
      amount_fx: round2(new Big(input.amountFx)),
      rate: input.rate,
      note: input.note ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deletePayment(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setOpeningBalance(
  customerId: string,
  opening: OpeningBalance | undefined,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      opening_balance: opening ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerId);
  if (error) throw new Error(error.message);
}
