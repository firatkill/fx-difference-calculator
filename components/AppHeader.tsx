import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

/** Sayfaların üstünde tekrar kullanılan üst çubuk: kullanıcı e-postası + hesap/çıkış */
export default async function AppHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-6 py-2 text-sm">
      <span className="text-slate-500">{user?.email}</span>
      <Link href="/hesabim" className="text-slate-600 hover:underline">
        Hesabım
      </Link>
      <SignOutButton />
    </div>
  );
}
