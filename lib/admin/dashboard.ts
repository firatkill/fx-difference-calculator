import "server-only";
import Big from "big.js";
import {
  adminListCustomers,
  adminListInvoices,
  adminListPayments,
} from "@/lib/supabase/admin-repo";
import { compute } from "@/lib/engine/fifo";
import { round2 } from "@/lib/money";
import type {
  DashboardData,
  MonthlyKurFarki,
  RecentTransaction,
  TopCustomer,
} from "@/lib/dashboard";

/**
 * lib/dashboard.ts'in admin görünümü karşılığı — aynı agregasyon mantığı
 * (compute() aynen yeniden kullanılır), ama tek bir hedef kullanıcının
 * verisi üzerinde, admin-repo'nun service-role/açık-filtreli sorgularıyla.
 */
export async function adminLoadDashboardData(
  targetUserId: string,
): Promise<DashboardData> {
  const customers = await adminListCustomers(targetUserId);

  let totalInvoiced = new Big(0);
  let totalKurFarki = new Big(0);
  let totalOpenBalance = new Big(0);
  const monthlyMap = new Map<string, Big>();
  const topCustomers: TopCustomer[] = [];
  const recent: RecentTransaction[] = [];

  await Promise.all(
    customers.map(async (c) => {
      const [invoices, payments] = await Promise.all([
        adminListInvoices(c.id),
        adminListPayments(c.id),
      ]);
      const result = compute({ opening: c.openingBalance, invoices, payments });

      totalInvoiced = totalInvoiced.plus(result.summary.totalInvoicedFx);
      totalKurFarki = totalKurFarki.plus(result.summary.totalKurFarkiTl);

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

  const monthlyKurFarki: MonthlyKurFarki[] = Array.from(monthlyMap.entries())
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
