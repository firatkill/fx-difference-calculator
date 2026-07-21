import AdminShell from "@/components/AdminShell";
import AdminUserDetailScreen from "@/components/AdminUserDetailScreen";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminListCustomers } from "@/lib/supabase/admin-repo";
import { adminLoadDashboardData } from "@/lib/admin/dashboard";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin();

  const admin = createAdminClient();
  const { data: userData } = await admin.auth.admin.getUserById(id);
  const title = userData.user?.email ?? "Kullanıcı";

  const [customers, dashboard] = await Promise.all([
    adminListCustomers(id),
    adminLoadDashboardData(id),
  ]);

  return (
    <AdminShell
      title={title}
      breadcrumb={[{ label: "Kullanıcılar", href: "/admin" }]}
    >
      <AdminUserDetailScreen customers={customers} dashboard={dashboard} />
    </AdminShell>
  );
}
