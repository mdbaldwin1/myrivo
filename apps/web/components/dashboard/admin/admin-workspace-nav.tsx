"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Scale, ScrollText, LayoutDashboard, FileText, ChartNoAxesColumn, Users, DollarSign } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard/admin", label: "Admin Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/admin/team", label: "Team", icon: Users },
  { href: "/dashboard/admin/users", label: "Users", icon: Users },
  { href: "/dashboard/admin/stores", label: "Stores", icon: Scale },
  { href: "/dashboard/admin/revenue", label: "Revenue", icon: DollarSign },
  { href: "/dashboard/admin/audit", label: "Audit Explorer", icon: ScrollText },
  { href: "/dashboard/admin/legal", label: "Legal Governance", icon: FileText },
  { href: "/dashboard/admin/marketing", label: "Marketing Analytics", icon: ChartNoAxesColumn }
] as const;

export function AdminWorkspaceNav() {
  const pathname = usePathname();
  const normalizedPath = pathname?.replace(/\/$/, "") ?? "";

  return (
    <div className="space-y-3">
      <div className="hidden items-center gap-2 px-2 lg:flex">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Admin Workspace</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
        {links.map((link) => {
          const isActive = normalizedPath === link.href || normalizedPath.startsWith(`${link.href}/`);
          return (
            <Link
              key={`mobile-${link.href}`}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(buttonVariants({ variant: isActive ? "default" : "outline", size: "sm" }), "whitespace-nowrap")}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      <div className="hidden space-y-1 lg:block">
        {links.map((link) => {
          const isActive = normalizedPath === link.href || normalizedPath.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(buttonVariants({ variant: isActive ? "default" : "ghost", size: "sm" }), "w-full justify-start")}
            >
              <span className="flex items-center gap-2">
                <link.icon className="h-4 w-4 shrink-0" />
                <span>{link.label}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
