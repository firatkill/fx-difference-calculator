"use client";

import { useState } from "react";
import Sidebar, { type NavLink } from "@/components/Sidebar";
import Header, { type Crumb } from "@/components/Header";

export default function SidebarLayout({
  userEmail,
  links,
  accountHref,
  title,
  breadcrumb,
  children,
}: {
  userEmail: string;
  links: NavLink[];
  accountHref: string;
  title: string;
  breadcrumb: Crumb[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        open={open}
        userEmail={userEmail}
        links={links}
        accountHref={accountHref}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          title={title}
          breadcrumb={breadcrumb}
          open={open}
          onToggle={() => setOpen((o) => !o)}
        />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
