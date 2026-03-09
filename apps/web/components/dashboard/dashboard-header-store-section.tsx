"use client";

import { usePathname } from "next/navigation";
import type { StoreOption } from "@/components/dashboard/store-switcher";
import { DashboardHeaderStoreControl } from "@/components/dashboard/dashboard-header-store-control";

type DashboardHeaderStoreSectionProps = {
  hasStoreAccess: boolean;
  activeStoreSlug: string | null;
  storeStatus: string | null;
  stores: StoreOption[];
};

export function DashboardHeaderStoreSection({ hasStoreAccess, activeStoreSlug, storeStatus, stores }: DashboardHeaderStoreSectionProps) {
  const pathname = usePathname();
  const isStoreWorkspaceRoute = Boolean(
    activeStoreSlug &&
      pathname &&
      (pathname === `/dashboard/stores/${activeStoreSlug}` || pathname.startsWith(`/dashboard/stores/${activeStoreSlug}/`))
  );

  if (!hasStoreAccess || !activeStoreSlug || !isStoreWorkspaceRoute) {
    return <h1 className="truncate text-base sm:text-lg">Dashboard</h1>;
  }

  return (
    <>
      <div className="max-w-[min(26rem,62vw)]">
        <DashboardHeaderStoreControl key={activeStoreSlug} activeStoreSlug={activeStoreSlug} stores={stores} />
      </div>
      {storeStatus ? (
        <p className="shrink-0 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {storeStatus}
        </p>
      ) : null}
    </>
  );
}
