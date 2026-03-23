"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { DashboardHeaderBackButton } from "@/components/dashboard/dashboard-header-back-button";
import { DashboardHeaderNotifications } from "@/components/dashboard/dashboard-header-notifications";
import { DashboardHeaderStorefrontLink } from "@/components/dashboard/dashboard-header-storefront-link";
import { DashboardHeaderStoreSection } from "@/components/dashboard/dashboard-header-store-section";
import { DashboardMobileNavSheet } from "@/components/dashboard/dashboard-mobile-nav-sheet";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { useLocalStorageFlag, writeLocalStorageFlag } from "@/components/dashboard/use-local-storage-flag";
import { Button, buttonVariants } from "@/components/ui/button";
import { MAIN_CONTENT_ID } from "@/lib/accessibility";
import { isDashboardOnboardingPath, resolveCurrentStoreWorkspaceSlug } from "@/lib/routes/store-workspace";
import { cn } from "@/lib/utils";
import type { StoreOption } from "@/components/dashboard/store-switcher";
import type { GlobalUserRole, StoreStatus } from "@/types/database";
import type { StoreOnboardingProgress } from "@/lib/stores/onboarding";

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
  analyticsDashboardEnabled: boolean;
  hasStoreAccess: boolean;
  storeStatus: StoreStatus | null;
  storeOnboardingProgress: StoreOnboardingProgress | null;
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
  analyticsDashboardEnabled,
  hasStoreAccess,
  storeStatus,
  storeOnboardingProgress
}: DashboardShellProps) {
  const sidebarCollapsed = useLocalStorageFlag(DASHBOARD_SIDEBAR_STORAGE_KEY);
  const pathname = usePathname();
  const effectiveStoreSlug = resolveCurrentStoreWorkspaceSlug(pathname, activeStoreSlug);
  const effectiveHasStoreAccess = hasStoreAccess || Boolean(effectiveStoreSlug);
  const focusedOnboardingShell = isDashboardOnboardingPath(pathname);

  function handleSidebarCollapsedChange(nextCollapsed: boolean) {
    writeLocalStorageFlag(DASHBOARD_SIDEBAR_STORAGE_KEY, nextCollapsed);
  }

  if (focusedOnboardingShell) {
    return (
      <div data-dashboard-shell="true" data-dashboard-shell-mode="onboarding" className="fixed inset-0 flex w-full flex-col overflow-hidden bg-stone-50">
        <main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          data-dashboard-scroll-container="true"
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-none bg-stone-50 focus:outline-none"
        >
          <div className="flex min-h-full min-w-0 flex-1 flex-col">{children}</div>
        </main>
      </div>
    );
  }

  return (
    <div data-dashboard-shell="true" className="fixed inset-0 flex w-full flex-col overflow-hidden bg-stone-50">
      <header className="shrink-0 border-b border-border/70 bg-white/95 supports-[backdrop-filter]:bg-white/90 supports-[backdrop-filter]:backdrop-blur">
        <div className="grid h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <DashboardHeaderBackButton />
            <Link href="/dashboard" className="flex items-center gap-2">
              <Image src="/brand/myrivo-mark.svg" alt="Myrivo logo" width={20} height={20} className="h-5 w-5 rounded-sm" />
              <p className="hidden text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:block">Myrivo</p>
            </Link>
            <span className="hidden h-4 w-px bg-border sm:block" />
            <DashboardHeaderStoreSection
              hasStoreAccess={effectiveHasStoreAccess}
              activeStoreSlug={effectiveStoreSlug}
              storeStatus={storeStatus}
              stores={stores}
              storeOnboardingProgress={storeOnboardingProgress}
              mode="identity"
            />
          </div>
          <div className="hidden min-w-0 items-center justify-center lg:flex">
            <DashboardHeaderStoreSection
              hasStoreAccess={effectiveHasStoreAccess}
              activeStoreSlug={effectiveStoreSlug}
              storeStatus={storeStatus}
              stores={stores}
              storeOnboardingProgress={storeOnboardingProgress}
              mode="lifecycle"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Link href="/docs" target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Docs
            </Link>
            <DashboardHeaderStorefrontLink storeSlug={effectiveStoreSlug} />
            <DashboardHeaderNotifications storeSlug={effectiveStoreSlug} initialNotificationSoundEnabled={initialNotificationSoundEnabled} />
            <DashboardMobileNavSheet
              activeStoreSlug={effectiveStoreSlug}
              stores={stores}
              globalRole={globalRole}
              userDisplayName={userDisplayName}
              userEmail={userEmail}
              userAvatarPath={userAvatarPath}
              analyticsDashboardEnabled={analyticsDashboardEnabled}
            />
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
          <aside className="flex w-full shrink-0 border-r border-border/70 bg-stone-50">
            <DashboardNav
              activeStoreSlug={effectiveStoreSlug}
              stores={stores}
              globalRole={globalRole}
              userDisplayName={userDisplayName}
              userEmail={userEmail}
              userAvatarPath={userAvatarPath}
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

        <main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          data-dashboard-scroll-container="true"
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-none bg-stone-50 focus:outline-none"
        >
          <div className="flex min-h-full min-w-0 flex-1 flex-col">{children}</div>
        </main>
      </div>
    </div>
  );
}
