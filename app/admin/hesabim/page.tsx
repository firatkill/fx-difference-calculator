import AdminShell from "@/components/AdminShell";
import HesabimScreen from "@/components/HesabimScreen";

export default function AdminHesabimPage() {
  return (
    <AdminShell
      title="Hesabım"
      breadcrumb={[{ label: "Kullanıcılar", href: "/admin" }]}
    >
      <HesabimScreen />
    </AdminShell>
  );
}
