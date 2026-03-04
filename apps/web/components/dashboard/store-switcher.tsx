"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
  className?: string;
  selectClassName?: string;
  autoFocus?: boolean;
  onSwitchComplete?: () => void;
  onSwitchSuccess?: (nextSlug: string) => void;
};

type ActiveStoreResponse = {
  error?: string;
};

export function StoreSwitcher({
  activeStoreSlug,
  stores,
  className,
  selectClassName,
  autoFocus = false,
  onSwitchComplete,
  onSwitchSuccess
}: StoreSwitcherProps) {
  const router = useRouter();
  const selectRef = useRef<HTMLButtonElement | null>(null);
  const [value, setValue] = useState(activeStoreSlug);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sortedStores = useMemo(() => [...stores].sort((a, b) => a.name.localeCompare(b.name)), [stores]);

  useEffect(() => {
    if (autoFocus && selectRef.current) {
      selectRef.current.focus();
      requestAnimationFrame(() => {
        selectRef.current?.click();
      });
    }
  }, [autoFocus]);

  async function onStoreChange(nextValue: string) {
    if (nextValue === value || isPending) {
      onSwitchComplete?.();
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
    onSwitchSuccess?.(nextValue);
    onSwitchComplete?.();
  }

  return (
    <div className={cn("w-full min-w-0 space-y-1", className)}>
      <Select
        ref={selectRef}
        className={selectClassName}
        value={value}
        icon="up-down"
        disabled={isPending}
        onOpenChange={(open) => {
          if (!open) {
            onSwitchComplete?.();
          }
        }}
        onChange={(event) => void onStoreChange(event.target.value)}
      >
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
