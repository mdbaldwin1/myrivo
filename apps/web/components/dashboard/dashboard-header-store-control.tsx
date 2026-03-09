"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronsUpDown, Store } from "lucide-react";
import { StoreSwitcher, type StoreOption } from "@/components/dashboard/store-switcher";
import { Button } from "@/components/ui/button";

type DashboardHeaderStoreControlProps = {
  activeStoreSlug: string;
  stores: StoreOption[];
};

export function DashboardHeaderStoreControl({ activeStoreSlug, stores }: DashboardHeaderStoreControlProps) {
  const [editing, setEditing] = useState(false);
  const [optimisticStoreSlug, setOptimisticStoreSlug] = useState<string | null>(null);
  const effectiveStoreSlug = optimisticStoreSlug ?? activeStoreSlug;
  const activeStore = useMemo(() => stores.find((store) => store.slug === effectiveStoreSlug) ?? null, [stores, effectiveStoreSlug]);

  if (editing) {
    return (
      <StoreSwitcher
        activeStoreSlug={activeStoreSlug}
        stores={stores}
        autoFocus
        onSwitchSuccess={(nextSlug) => setOptimisticStoreSlug(nextSlug)}
        onSwitchComplete={() => setEditing(false)}
        className="w-fit"
        selectClassName="h-9 w-auto min-w-[12rem] max-w-[min(26rem,62vw)] text-sm"
      />
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Link href={`/dashboard/stores/${activeStoreSlug}`} className="flex min-w-0 items-center gap-2 truncate text-sm text-foreground hover:underline">
        <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{activeStore?.name ?? "Store"}</span>
      </Link>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8 shrink-0"
        aria-label="Switch active store"
        onClick={() => setEditing(true)}
      >
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  );
}
