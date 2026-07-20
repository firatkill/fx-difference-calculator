import AppShell from "@/components/AppShell";
import CustomerScreen from "@/components/CustomerScreen";

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell>
      <CustomerScreen customerId={id} />
    </AppShell>
  );
}
