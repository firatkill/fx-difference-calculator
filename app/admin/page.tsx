import AdminShell from "@/components/AdminShell";
import AdminUserListScreen from "@/components/AdminUserListScreen";
import { listAllUsers } from "@/lib/admin/actions";

export default async function AdminPage() {
  const users = await listAllUsers();

  return (
    <AdminShell title="Kullanıcılar">
      <AdminUserListScreen initialUsers={users} />
    </AdminShell>
  );
}
