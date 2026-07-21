import AppShell from "@/components/AppShell";
import CustomerScreen from "@/components/CustomerScreen";
import { createClient } from "@/lib/supabase/server";

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("customer_name")
    .eq("id", id)
    .maybeSingle();
  const title = data?.customer_name ?? "Müşteri";

  return (
    <AppShell
      title={title}
      breadcrumb={[
        { label: "Ana Sayfa", href: "/" },
        { label: "Müşterilerim", href: "/customers" },
      ]}
    >
      <CustomerScreen customerId={id} />
    </AppShell>
  );
}
