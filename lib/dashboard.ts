import Big from "big.js";
import { listCustomers, listInvoices, listPayments } from "@/lib/supabase/repo";
import { compute } from "@/lib/engine/fifo";
import { round2 } from "@/lib/money";

export interface MonthlyKurFarki {
  /** "YYYY-MM" */
  month: string;
  amountTl: string;
}

export interface TopCustomer {
  id: string;
  name: string;
  balanceFx: string;
}

export interface RecentTransaction {
  id: string;
  customerId: string;
  customerName: string;
  kind: "INVOICE" | "PAYMENT";
  date: string;
  docNo: string;
  amountFx: string;
}

export interface DashboardData {
  totalCustomers: number;
  totalInvoicedFx: string;
  totalKurFarkiTl: string;
  totalOpenBalanceFx: string;
  monthlyKurFarki: MonthlyKurFarki[];
  topCustomers: TopCustomer[];
  recentTransactions: RecentTransaction[];
}

/**
 * Tüm müşteriler genelinde özet/grafik verisini toplar. Her müşteri için
 * ayrı ayrı invoices/payments çekilip lib/engine/fifo'nun compute()'u
 * çalıştırılır (N+1, ama listCustomers()'ın kendi countRows deseniyle
 * tutarlı — bu ölçekte backend agregasyonu gerekmiyor).
 */
export async function loadDashboardData(): Promise<DashboardData> {
  const customers = await listCustomers();

  let totalInvoiced = new Big(0);
  let totalKurFarki = new Big(0);
  let totalOpenBalance = new Big(0);
  const monthlyMap = new Map<string, Big>();
  const topCustomers: TopCustomer[] = [];
  const recent: RecentTransaction[] = [];

  await Promise.all(
    customers.map(async (c) => {
      const [invoices, payments] = await Promise.all([
        listInvoices(c.id),
        listPayments(c.id),
      ]);
      const result = compute({ opening: c.openingBalance, invoices, payments });

      totalInvoiced = totalInvoiced.plus(result.summary.totalInvoicedFx);
      totalKurFarki = totalKurFarki.plus(result.summary.totalKurFarkiTl);

      // Bir müşterinin avansı (negatif bakiye) diğerinin borcunu netlemesin
      const balance = new Big(result.summary.balanceFx);
      if (balance.gt(0)) totalOpenBalance = totalOpenBalance.plus(balance);

      topCustomers.push({
        id: c.id,
        name: c.customerName,
        balanceFx: result.summary.balanceFx,
      });

      const rowByKey = new Map(result.rows.map((r) => [r.key, r]));
      for (const alloc of result.allocations) {
        if (!alloc.kurFarkiTl) continue;
        const paymentRow = rowByKey.get(alloc.paymentKey);
        if (!paymentRow) continue;
        const month = paymentRow.date.slice(0, 7);
        monthlyMap.set(
          month,
          (monthlyMap.get(month) ?? new Big(0)).plus(alloc.kurFarkiTl),
        );
      }

      for (const row of result.rows) {
        if (row.kind === "OPENING") continue;
        recent.push({
          id: row.key,
          customerId: c.id,
          customerName: c.customerName,
          kind: row.kind,
          date: row.date,
          docNo: row.docNo,
          amountFx: row.amountFx,
        });
      }
    }),
  );

  const monthlyKurFarki = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, amount]) => ({ month, amountTl: round2(amount) }));

  const topCustomersSorted = topCustomers
    .filter((c) => new Big(c.balanceFx).gt(0))
    .sort((a, b) => new Big(b.balanceFx).minus(a.balanceFx).toNumber())
    .slice(0, 5);

  recent.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return {
    totalCustomers: customers.length,
    totalInvoicedFx: round2(totalInvoiced),
    totalKurFarkiTl: round2(totalKurFarki),
    totalOpenBalanceFx: round2(totalOpenBalance),
    monthlyKurFarki,
    topCustomers: topCustomersSorted,
    recentTransactions: recent.slice(0, 10),
  };
}
