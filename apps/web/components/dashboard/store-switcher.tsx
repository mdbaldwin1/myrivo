"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";

export type StoreOption = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "active" | "suspended";
  role: "owner" | "admin" | "staff" | "customer" | "support";
};

type StoreSwitcherProps = {
  activeStoreSlug: string;
  stores: StoreOption[];
};

type ActiveStoreResponse = {
  error?: string;
};

export function StoreSwitcher({ activeStoreSlug, stores }: StoreSwitcherProps) {
  const router = useRouter();
  const [value, setValue] = useState(activeStoreSlug);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sortedStores = useMemo(() => [...stores].sort((a, b) => a.name.localeCompare(b.name)), [stores]);

  async function onStoreChange(nextValue: string) {
    if (nextValue === value || isPending) {
      return;
    }

    setError(null);
    setValue(nextValue);

    const response = await fetch("/api/stores/active", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: nextValue })
    });

    if (!response.ok) {
      const payload = (await response.json()) as ActiveStoreResponse;
      setError(payload.error ?? "Failed to switch stores.");
      setValue(activeStoreSlug);
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="w-full min-w-0 space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Active Store</p>
      <Select value={value} disabled={isPending} onChange={(event) => void onStoreChange(event.target.value)}>
        {sortedStores.map((store) => (
          <option key={store.id} value={store.slug}>
            {store.name}
          </option>
        ))}
      </Select>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
