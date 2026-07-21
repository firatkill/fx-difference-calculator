import AppShell from "@/components/AppShell";
import DashboardScreen from "@/components/DashboardScreen";

export default function HomePage() {
  return (
    <AppShell title="Ana Sayfa" breadcrumb={[]}>
      <DashboardScreen />
    </AppShell>
  );
}
