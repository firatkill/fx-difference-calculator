import AppShell from "@/components/AppShell";
import HesabimScreen from "@/components/HesabimScreen";

export default function HesabimPage() {
  return (
    <AppShell title="Hesabım" breadcrumb={[{ label: "Ana Sayfa", href: "/" }]}>
      <HesabimScreen />
    </AppShell>
  );
}
