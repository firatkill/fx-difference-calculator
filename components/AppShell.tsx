import { createClient } from "@/lib/supabase/server";
import SidebarLayout from "@/components/SidebarLayout";

/** Sunucu tarafında kullanıcı e-postasını alıp sidebar'lı kabuğu render eder */
export default async function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <SidebarLayout userEmail={user?.email ?? ""}>{children}</SidebarLayout>;
}
