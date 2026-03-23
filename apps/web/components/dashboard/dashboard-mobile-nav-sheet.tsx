"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { useHasMounted } from "@/components/use-has-mounted";
import type { StoreOption } from "@/components/dashboard/store-switcher";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { GlobalUserRole } from "@/types/database";

type DashboardMobileNavSheetProps = {
  activeStoreSlug: string | null;
  stores: StoreOption[];
  globalRole: GlobalUserRole;
  userDisplayName?: string | null;
  userEmail?: string | null;
  userAvatarPath?: string | null;
  analyticsDashboardEnabled: boolean;
};

export function DashboardMobileNavSheet({
  activeStoreSlug,
  stores,
  globalRole,
  userDisplayName,
  userEmail,
  userAvatarPath,
  analyticsDashboardEnabled
}: DashboardMobileNavSheetProps) {
  const hasMounted = useHasMounted();
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  if (!hasMounted) {
    return (
      <Button type="button" variant="ghost" size="icon" aria-label="Open dashboard navigation menu" className="lg:hidden">
        <Menu className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Sheet key={pathname} open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="Open dashboard navigation menu" className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[88vw] max-w-sm flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border px-4 py-4">
          <SheetTitle>Dashboard Navigation</SheetTitle>
          <SheetDescription>Switch sections without leaving your current store context.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-hidden px-3 py-3">
          <DashboardNav
            activeStoreSlug={activeStoreSlug}
            stores={stores}
            globalRole={globalRole}
            userDisplayName={userDisplayName}
            userEmail={userEmail}
            userAvatarPath={userAvatarPath}
            analyticsDashboardEnabled={analyticsDashboardEnabled}
            mode="mobile"
            className="h-full"
            onNavigate={() => setIsOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
