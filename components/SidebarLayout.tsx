"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";

export default function SidebarLayout({
  userEmail,
  children,
}: {
  userEmail: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menüyü aç"
        className="fixed left-4 top-4 z-30 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-100"
      >
        ☰
      </button>
      <Sidebar open={open} onClose={() => setOpen(false)} userEmail={userEmail} />
      <div className="pt-14">{children}</div>
    </div>
  );
}
