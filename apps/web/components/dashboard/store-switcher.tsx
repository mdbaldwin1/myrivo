"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, ChevronsUpDown, Store } from "lucide-react";
import { AppAlert } from "@/components/ui/app-alert";
import { cn } from "@/lib/utils";

export type StoreOption = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed";
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
  const selectedStore = useMemo(() => sortedStores.find((store) => store.slug === value) ?? null, [sortedStores, value]);

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
      <SelectPrimitive.Root
        value={value}
        onOpenChange={(open) => {
          if (!open) {
            onSwitchComplete?.();
          }
        }}
        onValueChange={(nextValue) => void onStoreChange(nextValue)}
      >
        <SelectPrimitive.Trigger
          ref={selectRef}
          disabled={isPending}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            selectClassName
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{selectedStore?.name ?? "Select store"}</span>
          </span>
          <SelectPrimitive.Icon>
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={6}
            align="start"
            className="relative z-50 max-h-96 w-[var(--radix-select-trigger-width)] min-w-[12rem] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out"
          >
            <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1">
              <ChevronUp className="h-4 w-4" />
            </SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport className="p-1">
              {sortedStores.map((store) => {
                return (
                  <SelectPrimitive.Item
                    key={store.id}
                    value={store.slug}
                    className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                  >
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      <SelectPrimitive.ItemIndicator>
                        <Check className="h-4 w-4" />
                      </SelectPrimitive.ItemIndicator>
                    </span>
                    <SelectPrimitive.ItemText>
                      <span className="truncate">{store.name}</span>
                    </SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>
                );
              })}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
              <ChevronDown className="h-4 w-4" />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      <AppAlert variant="error" compact className="text-xs" message={error} />
    </div>
  );
}
