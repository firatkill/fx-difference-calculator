import { createClient } from "@/lib/supabase/server";
import SidebarLayout from "@/components/SidebarLayout";
import type { Crumb } from "@/components/Header";

const NAV_LINKS = [{ href: "/admin", label: "Kullanıcılar" }];

/** AppShell'in admin alanı karşılığı — aynı desen, farklı nav linkleri */
export default async function AdminShell({
  title,
  breadcrumb = [],
  children,
}: {
  title: string;
  breadcrumb?: Crumb[];
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <SidebarLayout
      userEmail={user?.email ?? ""}
      links={NAV_LINKS}
      accountHref="/admin/hesabim"
      title={title}
      breadcrumb={breadcrumb}
    >
      {children}
    </SidebarLayout>
  );
}
