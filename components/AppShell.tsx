import { createClient } from "@/lib/supabase/server";
import SidebarLayout from "@/components/SidebarLayout";
import type { Crumb } from "@/components/Header";

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
    <SidebarLayout userEmail={user?.email ?? ""} title={title} breadcrumb={breadcrumb}>
      {children}
    </SidebarLayout>
  );
}
