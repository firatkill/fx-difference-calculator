import AppHeader from "@/components/AppHeader";
import CustomerScreen from "@/components/CustomerScreen";

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <AppHeader />
      <CustomerScreen customerId={id} />
    </>
  );
}
