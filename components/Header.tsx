"use client";

import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

interface Props {
  title: string;
  breadcrumb: Crumb[];
  open: boolean;
  onToggle: () => void;
}

export default function Header({ title, breadcrumb, open, onToggle }: Props) {
  return (
    <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-4">
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
        className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
      >
        {open ? "⟨" : "☰"}
      </button>
      <div className="min-w-0">
        {breadcrumb.length > 0 && (
          <nav className="mb-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-400">
            {breadcrumb.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span>/</span>}
                {c.href ? (
                  <Link href={c.href} className="hover:text-slate-600 hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-slate-500">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-xl font-bold text-slate-900">{title}</h1>
      </div>
    </header>
  );
}
