import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";

interface Props {
  open: boolean;
  userEmail: string;
}

/**
 * Ekrana entegre (docked) sidebar — overlay değil. Sadece tıklanabilir
 * linkler içerir; müşteri listesi kaldırıldı, bkz. /customers sayfası.
 */
export default function Sidebar({ open, userEmail }: Props) {
  if (!open) return null;

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center justify-center border-b border-slate-200 px-4 py-4">
        <img src="/company-logo.avif" alt="Şirket logosu" className="h-10 w-auto" />
      </div>

      <nav className="px-2 py-3">
        <Link
          href="/"
          className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Ana Sayfa
        </Link>
        <Link
          href="/customers"
          className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Müşterilerim
        </Link>
      </nav>

      <div className="flex-1" />

      <div className="border-t border-slate-200 p-3">
        <div className="truncate px-1 pb-2 text-xs text-slate-500">{userEmail}</div>
        <Link
          href="/hesabim"
          className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Hesabım
        </Link>
        <SignOutButton />
      </div>
    </aside>
  );
}
