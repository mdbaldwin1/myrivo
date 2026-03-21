"use client";

import { usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { DashboardHeaderStoreLifecycleControls } from "@/components/dashboard/dashboard-header-store-lifecycle-controls";
import type { StoreOption } from "@/components/dashboard/store-switcher";
import { DashboardHeaderStoreControl } from "@/components/dashboard/dashboard-header-store-control";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getStoreLifecycleLabel, getStoreLifecycleTone } from "@/lib/stores/lifecycle";
import type { StoreOnboardingProgress } from "@/lib/stores/onboarding";
import type { StoreStatus } from "@/types/database";
import { cn } from "@/lib/utils";

type DashboardHeaderStoreSectionProps = {
  hasStoreAccess: boolean;
  activeStoreSlug: string | null;
  storeStatus: string | null;
  stores: StoreOption[];
  storeOnboardingProgress: StoreOnboardingProgress | null;
  mode?: "identity" | "lifecycle";
};

export function DashboardHeaderStoreSection({
  hasStoreAccess,
  activeStoreSlug,
  storeStatus,
  stores,
  storeOnboardingProgress,
  mode = "identity"
}: DashboardHeaderStoreSectionProps) {
  const pathname = usePathname();
  const isStoreWorkspaceRoute = Boolean(
    activeStoreSlug &&
      pathname &&
      (pathname === `/dashboard/stores/${activeStoreSlug}` || pathname.startsWith(`/dashboard/stores/${activeStoreSlug}/`))
  );

  if (!hasStoreAccess || !activeStoreSlug || !isStoreWorkspaceRoute) {
    return mode === "identity" ? <h1 className="truncate text-base sm:text-lg">Dashboard</h1> : null;
  }

  if (mode === "identity") {
    return (
      <div className="max-w-[min(26rem,62vw)]">
        <DashboardHeaderStoreControl key={activeStoreSlug} activeStoreSlug={activeStoreSlug} stores={stores} />
      </div>
    );
  }

  const showNoTaxIndicator = storeOnboardingProgress?.taxCollectionMode === "seller_attested_no_tax";

  return (
    <div className="flex min-w-0 items-center justify-center gap-2">
      {(storeStatus || storeOnboardingProgress) ? (
        <div className="flex items-center gap-2 rounded-full border border-border/70 bg-stone-50/80 px-2 py-1">
          {storeStatus ? (
            <p
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide",
                getStoreLifecycleTone(storeStatus as StoreStatus) === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
                getStoreLifecycleTone(storeStatus as StoreStatus) === "warning" && "border-amber-200 bg-amber-50 text-amber-800",
                getStoreLifecycleTone(storeStatus as StoreStatus) === "danger" && "border-rose-200 bg-rose-50 text-rose-800",
                getStoreLifecycleTone(storeStatus as StoreStatus) === "info" && "border-sky-200 bg-sky-50 text-sky-800",
                getStoreLifecycleTone(storeStatus as StoreStatus) === "neutral" && "border-border bg-white text-muted-foreground"
              )}
            >
              {getStoreLifecycleLabel(storeStatus as StoreStatus)}
            </p>
          ) : null}
          {showNoTaxIndicator ? (
            <TooltipProvider delayDuration={120}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-800">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span className="sr-only">Seller-attested no-tax path is active</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Seller-attested no-tax path is active for this store.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
          {storeOnboardingProgress ? <DashboardHeaderStoreLifecycleControls progress={storeOnboardingProgress} mode="action" /> : null}
        </div>
      ) : null}
      {storeOnboardingProgress ? <DashboardHeaderStoreLifecycleControls progress={storeOnboardingProgress} mode="summary" /> : null}
    </div>
  );
}
