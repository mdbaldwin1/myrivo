"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Bell, PanelLeftClose, PanelLeftOpen, Settings, UserCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { writeLocalStorageFlag, useLocalStorageFlag } from "@/components/dashboard/use-local-storage-flag";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MAIN_CONTENT_ID } from "@/lib/accessibility";
import { cn } from "@/lib/utils";

type AccountWorkspaceShellProps = {
  activeItem: "profile" | "notifications" | "settings";
  backHref: string;
  children: ReactNode;
};

const navItems: Array<{ id: "profile" | "notifications" | "settings"; label: string; href: string; icon: LucideIcon }> = [
  { id: "profile", label: "Profile", href: "/profile", icon: UserCircle2 },
  { id: "notifications", label: "Notifications", href: "/notifications", icon: Bell },
  { id: "settings", label: "Settings", href: "/settings", icon: Settings }
];

const DASHBOARD_SIDEBAR_STORAGE_KEY = "myrivo.dashboard-sidebar-collapsed";

function renderCollapsedTooltip(label: string, child: React.ReactNode) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{child}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function AccountWorkspaceShell({ activeItem, backHref, children }: AccountWorkspaceShellProps) {
  const sidebarCollapsed = useLocalStorageFlag(DASHBOARD_SIDEBAR_STORAGE_KEY);

  return (
    <div className="fixed inset-0 flex w-full flex-col overflow-hidden bg-stone-50">
      <header className="shrink-0 border-b border-border/70 bg-white/95 supports-[backdrop-filter]:bg-white/90 supports-[backdrop-filter]:backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href={backHref} aria-label="Go back" className={buttonVariants({ variant: "ghost", size: "icon", className: "h-8 w-8" })}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link href="/dashboard" className="flex items-center gap-2">
              <Image src="/brand/myrivo-mark.svg" alt="Myrivo logo" width={20} height={20} className="h-5 w-5 rounded-sm" />
              <p className="hidden text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:block">Myrivo</p>
            </Link>
            <span className="hidden h-4 w-px bg-border sm:block" />
            <h1 className="truncate text-base sm:text-lg">Account</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/docs" target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Docs
            </Link>
          </div>
        </div>
      </header>
      <div className="min-h-0 flex flex-1 overflow-hidden">
        <div
          className={cn(
            "relative hidden shrink-0 transition-[width] duration-200 ease-out lg:flex",
            "motion-reduce:transition-none",
            sidebarCollapsed ? "w-[5rem]" : "w-[18.5rem]"
          )}
        >
          <aside className={cn("w-full shrink-0 border-r border-border/70 bg-stone-50 py-3", sidebarCollapsed ? "px-0" : "px-3")}>
            <TooltipProvider delayDuration={150}>
              {!sidebarCollapsed ? (
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Account Workspace</p>
              ) : null}
              <div className="space-y-1">
                {navItems.map((item) => {
                  const link = (
                    <Link
                      key={item.id}
                      href={item.href}
                      aria-current={activeItem === item.id ? "page" : undefined}
                      className={cn(
                        buttonVariants({ variant: activeItem === item.id ? "default" : "ghost", size: "sm" }),
                        sidebarCollapsed ? "mx-auto h-10 w-10 justify-center rounded-xl px-0" : "w-full justify-start"
                      )}
                    >
                      {sidebarCollapsed ? (
                        <item.icon className="h-4 w-4 shrink-0" />
                      ) : (
                        <span className="flex items-center gap-2">
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </span>
                      )}
                    </Link>
                  );

                  if (!sidebarCollapsed) {
                    return link;
                  }

                  return (
                    <div key={`${item.id}-collapsed`} className="flex w-full justify-center">
                      {renderCollapsedTooltip(item.label, link)}
                    </div>
                  );
                })}
              </div>
            </TooltipProvider>
          </aside>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={sidebarCollapsed ? "Expand navigation sidebar" : "Collapse navigation sidebar"}
            aria-pressed={sidebarCollapsed}
            className="absolute right-0 top-6 z-20 hidden h-9 w-9 translate-x-1/2 rounded-full border-border/80 bg-white shadow-sm lg:inline-flex"
            onClick={() => writeLocalStorageFlag(DASHBOARD_SIDEBAR_STORAGE_KEY, !sidebarCollapsed)}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
        <main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-stone-50 focus:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
