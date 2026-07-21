import { createClient } from "@/lib/supabase/server";
import SidebarLayout from "@/components/SidebarLayout";
import type { Crumb } from "@/components/Header";

const NAV_LINKS = [
  { href: "/", label: "Ana Sayfa" },
  { href: "/customers", label: "Müşterilerim" },
];

/** Sunucu tarafında kullanıcı e-postasını alıp sidebar'lı kabuğu render eder */
export default async function AppShell({
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
      accountHref="/hesabim"
      title={title}
      breadcrumb={breadcrumb}
    >
      {children}
    </SidebarLayout>
  );
}
