import AppShell from "@/components/AppShell";
import CustomersScreen from "@/components/CustomersScreen";

export default function CustomersPage() {
  return (
    <AppShell
      title="Müşterilerim"
      breadcrumb={[{ label: "Ana Sayfa", href: "/" }]}
    >
      <CustomersScreen />
    </AppShell>
  );
}
