"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import type { StoreOption } from "@/components/dashboard/store-switcher";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { GlobalUserRole } from "@/types/database";

type DashboardMobileNavSheetProps = {
  activeStoreSlug: string | null;
  stores: StoreOption[];
  globalRole: GlobalUserRole;
};

export function DashboardMobileNavSheet({ activeStoreSlug, stores, globalRole }: DashboardMobileNavSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet key={pathname} open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <button type="button" aria-label="Open dashboard navigation menu" className={buttonVariants({ variant: "outline", size: "sm" }) + " lg:hidden"}>
          <Menu className="mr-2 h-4 w-4" />
          Menu
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[88vw] max-w-sm flex-col gap-0 p-4 pt-10">
        <SheetHeader className="mb-3">
          <SheetTitle>Dashboard Navigation</SheetTitle>
          <SheetDescription>Switch sections without leaving your current store context.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-hidden">
          <DashboardNav
            activeStoreSlug={activeStoreSlug}
            stores={stores}
            globalRole={globalRole}
            mode="mobile"
            className="h-full border-0 p-0"
            onNavigate={() => setIsOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
