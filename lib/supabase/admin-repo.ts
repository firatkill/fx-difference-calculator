import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowToCustomer, rowToInvoice, rowToPayment } from "@/lib/supabase/repo";
import type { Customer, Invoice, Payment } from "@/lib/types";

/**
 * Admin'in başka bir kullanıcının verisini SALT OKUNUR görüntülemesi için
 * kullanılan, service-role istemciyle çalışan repo katmanı. lib/repo.ts'ten
 * KASITLI OLARAK AYRI: service-role istemci RLS'i tamamen atlar, bu yüzden
 * örtük bir güvenlik ağı yoktur — her sorgu burada AÇIKÇA hedef kullanıcı/
 * müşteriyle filtrelenir. Bu dosya yalnızca Server Component'lerden import
 * edilir, asla bir "use client" dosyasından.
 */

export async function adminListCustomers(targetUserId: string): Promise<Customer[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("customers")
    .select("*")
    .eq("user_id", targetUserId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToCustomer);
}

export async function adminListInvoices(customerId: string): Promise<Invoice[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invoices")
    .select("*")
    .eq("customer_id", customerId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToInvoice);
}

export async function adminListPayments(customerId: string): Promise<Payment[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payments")
    .select("*")
    .eq("customer_id", customerId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToPayment);
}
