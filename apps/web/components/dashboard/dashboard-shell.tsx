"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { DashboardHeaderBackButton } from "@/components/dashboard/dashboard-header-back-button";
import { DashboardHeaderNotifications } from "@/components/dashboard/dashboard-header-notifications";
import { DashboardHeaderStorefrontLink } from "@/components/dashboard/dashboard-header-storefront-link";
import { DashboardHeaderStoreSection } from "@/components/dashboard/dashboard-header-store-section";
import { DashboardMobileNavSheet } from "@/components/dashboard/dashboard-mobile-nav-sheet";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { useLocalStorageFlag, writeLocalStorageFlag } from "@/components/dashboard/use-local-storage-flag";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StoreOption } from "@/components/dashboard/store-switcher";
import type { GlobalUserRole } from "@/types/database";

const DASHBOARD_SIDEBAR_STORAGE_KEY = "myrivo.dashboard-sidebar-collapsed";

type DashboardShellProps = {
  children: ReactNode;
  activeStoreSlug: string | null;
  stores: StoreOption[];
  globalRole: GlobalUserRole;
  userDisplayName?: string | null;
  userEmail?: string | null;
  userAvatarPath?: string | null;
  initialNotificationSoundEnabled: boolean;
  initialTestModeEnabled: boolean;
  canManageTestMode: boolean;
  analyticsDashboardEnabled: boolean;
  hasStoreAccess: boolean;
  storeStatus: string | null;
};

export function DashboardShell({
  children,
  activeStoreSlug,
  stores,
  globalRole,
  userDisplayName,
  userEmail,
  userAvatarPath,
  initialNotificationSoundEnabled,
  initialTestModeEnabled,
  canManageTestMode,
  analyticsDashboardEnabled,
  hasStoreAccess,
  storeStatus
}: DashboardShellProps) {
  const sidebarCollapsed = useLocalStorageFlag(DASHBOARD_SIDEBAR_STORAGE_KEY);

  function handleSidebarCollapsedChange(nextCollapsed: boolean) {
    writeLocalStorageFlag(DASHBOARD_SIDEBAR_STORAGE_KEY, nextCollapsed);
  }

  return (
    <main data-dashboard-shell="true" className="fixed inset-0 flex w-full flex-col overflow-hidden bg-stone-50">
      <header className="shrink-0 border-b border-border/70 bg-white/95 supports-[backdrop-filter]:bg-white/90 supports-[backdrop-filter]:backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <DashboardHeaderBackButton />
            <Link href="/dashboard" className="flex items-center gap-2">
              <Image src="/brand/myrivo-mark.svg" alt="Myrivo logo" width={20} height={20} className="h-5 w-5 rounded-sm" />
              <p className="hidden text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:block">Myrivo</p>
            </Link>
            <span className="hidden h-4 w-px bg-border sm:block" />
            <DashboardHeaderStoreSection hasStoreAccess={hasStoreAccess} activeStoreSlug={activeStoreSlug} storeStatus={storeStatus} stores={stores} />
          </div>
          <div className="flex items-center gap-2">
            <Link href="/docs" target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Docs
            </Link>
            <DashboardHeaderStorefrontLink storeSlug={activeStoreSlug} />
            <DashboardHeaderNotifications storeSlug={activeStoreSlug} initialNotificationSoundEnabled={initialNotificationSoundEnabled} />
            <DashboardMobileNavSheet
              activeStoreSlug={activeStoreSlug}
              stores={stores}
              globalRole={globalRole}
              userDisplayName={userDisplayName}
              userEmail={userEmail}
              userAvatarPath={userAvatarPath}
              initialTestModeEnabled={initialTestModeEnabled}
              canManageTestMode={canManageTestMode}
              analyticsDashboardEnabled={analyticsDashboardEnabled}
            />
          </div>
        </div>
      </header>

      <div className="min-h-0 flex flex-1 overflow-hidden">
        <div
          className={cn(
            "relative hidden shrink-0 transition-[width] duration-200 ease-out lg:flex",
            sidebarCollapsed ? "w-[5rem]" : "w-[18.5rem]"
          )}
        >
          <aside className="flex w-full shrink-0 border-r border-border/70 bg-stone-50">
            <DashboardNav
              activeStoreSlug={activeStoreSlug}
              stores={stores}
              globalRole={globalRole}
              userDisplayName={userDisplayName}
              userEmail={userEmail}
              userAvatarPath={userAvatarPath}
              initialTestModeEnabled={initialTestModeEnabled}
              canManageTestMode={canManageTestMode}
              analyticsDashboardEnabled={analyticsDashboardEnabled}
              collapsed={sidebarCollapsed}
              className={cn("w-full px-3 py-3", sidebarCollapsed && "px-0")}
            />
          </aside>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={sidebarCollapsed ? "Expand navigation sidebar" : "Collapse navigation sidebar"}
            aria-pressed={sidebarCollapsed}
            className="absolute right-0 top-6 z-20 hidden h-9 w-9 translate-x-1/2 rounded-full border-border/80 bg-white shadow-sm lg:inline-flex"
            onClick={() => handleSidebarCollapsedChange(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>

        <div data-dashboard-scroll-container="true" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-none bg-stone-50">
          <div className="flex min-h-full min-w-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    </main>
  );
}
