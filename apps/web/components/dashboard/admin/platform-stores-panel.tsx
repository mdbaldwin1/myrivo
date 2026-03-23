"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import type { BillingPlanOption, BillingPlanSummary } from "@/lib/billing/plans";
import { notify } from "@/lib/feedback/toast";
import { STORE_GOVERNANCE_REASON_CODES, STORE_GOVERNANCE_REASON_LABELS, type StoreGovernanceReasonCode } from "@/lib/platform/store-governance";

type StoreStatus = "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed";
type UserRole = "user" | "support" | "admin";

type PlatformStoresResponse = {
  role: UserRole;
  summary: {
    storesTotal: number;
    liveStoresCount: number;
    pendingStoresCount: number;
    suspendedStoresCount: number;
    offlineStoresCount: number;
  };
  plans: BillingPlanOption[];
  stores: Array<{
    id: string;
    owner_user_id: string;
    name: string;
    slug: string;
    status: StoreStatus;
    white_label_enabled: boolean;
    stripe_account_id: string | null;
    created_at: string;
    activeMemberCount: number;
    billingPlan: BillingPlanSummary | null;
    owner: {
      id: string;
      email: string | null;
      display_name: string | null;
    };
  }>;
  error?: string;
};

const statusFilterOptions: Array<{ value: "all" | StoreStatus; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "live", label: "Live" },
  { value: "offline", label: "Offline" },
  { value: "pending_review", label: "Pending review" },
  { value: "changes_requested", label: "Changes requested" },
  { value: "rejected", label: "Rejected" },
  { value: "draft", label: "Draft" },
  { value: "suspended", label: "Suspended" },
  { value: "removed", label: "Removed" }
];

const statusLabel: Record<StoreStatus, string> = {
  draft: "Draft",
  live: "Live",
  offline: "Offline",
  pending_review: "Pending review",
  changes_requested: "Changes requested",
  rejected: "Rejected",
  suspended: "Suspended",
  removed: "Removed"
};

export function PlatformStoresPanel() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightedStoreId = searchParams.get("storeId");
  const highlightedStoreRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StoreStatus>("all");
  const [data, setData] = useState<PlatformStoresResponse | null>(null);
  const [reasonCodeByStore, setReasonCodeByStore] = useState<Record<string, StoreGovernanceReasonCode>>({});
  const [reasonDetailByStore, setReasonDetailByStore] = useState<Record<string, string>>({});
  const [billingPlanKeyByStore, setBillingPlanKeyByStore] = useState<Record<string, string>>({});
  const [billingPlanErrorByStore, setBillingPlanErrorByStore] = useState<Record<string, string>>({});

  const canMutate = data?.role === "admin";
  const fallbackReasonCode: StoreGovernanceReasonCode = "incomplete_setup";
  const defaultBillingPlanKey = data?.plans?.find((plan) => plan.key === "standard")?.key ?? data?.plans?.[0]?.key ?? "standard";
  const plansByKey = useMemo(() => new Map((data?.plans ?? []).map((plan) => [plan.key, plan])), [data?.plans]);

  async function load() {
    const response = await fetch("/api/platform/stores", { cache: "no-store" });
    const payload = (await response.json()) as PlatformStoresResponse;
    if (!response.ok) {
      setLoading(false);
      return;
    }
    setData(payload);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/platform/stores", { cache: "no-store" });
      const payload = (await response.json()) as PlatformStoresResponse;
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setLoading(false);
        return;
      }
      setData(payload);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleStores = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (data?.stores ?? []).filter((store) => {
      if (statusFilter !== "all" && store.status !== statusFilter) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      const haystack = [store.name, store.slug, store.owner.display_name ?? "", store.owner.email ?? ""].join(" ").toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [data?.stores, query, statusFilter]);

  const pendingStores = useMemo(() => {
    return (data?.stores ?? []).filter((store) => store.status === "pending_review");
  }, [data?.stores]);

  useEffect(() => {
    if (!highlightedStoreId || !highlightedStoreRef.current) {
      return;
    }
    highlightedStoreRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightedStoreId, pendingStores]);

  function clearHighlightedStore() {
    if (!highlightedStoreId) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("storeId");
    const nextSearch = nextParams.toString();
    router.replace(nextSearch ? `${pathname}?${nextSearch}` : pathname, { scroll: false });
  }

  async function act(storeId: string, action: "approve" | "request_changes" | "reject" | "suspend" | "restore" | "remove") {
    if (!canMutate || savingId) {
      return;
    }

    const body =
      action === "approve" || action === "restore"
        ? { action }
        : {
            action,
            reasonCode: reasonCodeByStore[storeId] ?? fallbackReasonCode,
            reason: reasonDetailByStore[storeId]?.trim() || undefined
          };

    setSavingId(storeId);
    const response = await fetch(`/api/platform/stores/${storeId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    await response.json().catch(() => null);
    if (!response.ok) {
      setSavingId(null);
      return;
    }
    setSavingId(null);
    await load();
  }

  function getSelectedBillingPlanKey(store: PlatformStoresResponse["stores"][number]) {
    return billingPlanKeyByStore[store.id] ?? store.billingPlan?.key ?? defaultBillingPlanKey;
  }

  function clearBillingPlanError(storeId: string) {
    setBillingPlanErrorByStore((current) => {
      if (!current[storeId]) {
        return current;
      }

      const next = { ...current };
      delete next[storeId];
      return next;
    });
  }

  async function saveBillingPlan(store: PlatformStoresResponse["stores"][number]) {
    if (!canMutate || savingId || savingPlanId) {
      return;
    }

    const billingPlanKey = getSelectedBillingPlanKey(store);
    setSavingPlanId(store.id);
    clearBillingPlanError(store.id);

    const response = await fetch(`/api/platform/stores/${store.id}/billing-plan`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billingPlanKey })
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setBillingPlanErrorByStore((current) => ({
        ...current,
        [store.id]: payload?.error ?? "Unable to save pricing plan."
      }));
      setSavingPlanId(null);
      return;
    }

    notify.success("Pricing plan saved.");
    setSavingPlanId(null);
    await load();
  }

  return (
    <section className="space-y-4">
      <SectionCard title="Stores" description="Open the workspace, storefront, or governance flow for any store.">
        <div className="grid gap-2 pb-3 sm:grid-cols-[minmax(0,1fr)_180px]">
          <input
            className="h-10 rounded-md border border-border/70 bg-background px-3 text-sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search stores by name, slug, or owner"
          />
          <select
            className="h-10 rounded-md border border-border/70 bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | StoreStatus)}
          >
            {statusFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {visibleStores.length === 0 && !loading ? <p className="text-sm text-muted-foreground">No stores match the current filters.</p> : null}

        <div className="space-y-2">
          {visibleStores.map((store) => {
            const selectedBillingPlanKey = getSelectedBillingPlanKey(store);
            const currentBillingPlanKey = store.billingPlan?.key ?? defaultBillingPlanKey;
            const selectedPlan = plansByKey.get(selectedBillingPlanKey);
            const isBillingPlanDirty = selectedBillingPlanKey !== currentBillingPlanKey;
            const isStoreBusy = savingId === store.id || savingPlanId === store.id;

            return (
              <div key={store.id} className="space-y-3 rounded-md border border-border/70 px-3 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {store.name} <span className="text-muted-foreground">({store.slug})</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {statusLabel[store.status]}
                      {store.white_label_enabled ? " · white label" : ""}
                      {store.stripe_account_id ? " · payments connected" : " · payments not connected"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Owner: {store.owner.display_name ?? store.owner.email ?? "Unknown owner"} · {store.activeMemberCount} active member(s) · created{" "}
                      {new Date(store.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" asChild>
                      <Link href={`/dashboard/stores/${store.slug}`}>Open workspace</Link>
                    </Button>
                    <Button type="button" size="sm" variant="outline" asChild>
                      <Link href={`/s/${store.slug}`} target="_blank" rel="noreferrer">
                        View storefront
                      </Link>
                    </Button>
                    {store.status === "pending_review" ? (
                      <Button type="button" size="sm" variant="outline" asChild>
                        <Link href={`/dashboard/admin/stores?storeId=${encodeURIComponent(store.id)}`}>Review</Link>
                      </Button>
                    ) : null}
                    {store.status === "suspended" || store.status === "offline" ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => void act(store.id, "restore")} disabled={isStoreBusy}>
                        Restore
                      </Button>
                    ) : null}
                    {store.status !== "removed" ? (
                      <Button type="button" size="sm" variant="destructive" onClick={() => void act(store.id, "remove")} disabled={isStoreBusy}>
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-2 rounded-md border border-border/60 bg-muted/15 p-3 sm:grid-cols-[minmax(0,220px)_auto] sm:items-end">
                  <label className="text-xs">
                    <span className="mb-1 block font-medium text-muted-foreground">Pricing plan</span>
                    <select
                      className="h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm"
                      value={selectedBillingPlanKey}
                      onChange={(event) => {
                        const nextKey = event.target.value;
                        setBillingPlanKeyByStore((current) => ({
                          ...current,
                          [store.id]: nextKey
                        }));
                        clearBillingPlanError(store.id);
                      }}
                      disabled={!canMutate || isStoreBusy}
                    >
                      {(data?.plans ?? []).map((plan) => (
                        <option key={plan.key} value={plan.key}>
                          {plan.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setBillingPlanKeyByStore((current) => {
                          if (!(store.id in current)) {
                            return current;
                          }

                          const next = { ...current };
                          delete next[store.id];
                          return next;
                        });
                        clearBillingPlanError(store.id);
                      }}
                      disabled={!canMutate || isStoreBusy || !isBillingPlanDirty}
                    >
                      Reset
                    </Button>
                    <Button type="button" size="sm" onClick={() => void saveBillingPlan(store)} disabled={!canMutate || isStoreBusy || !isBillingPlanDirty}>
                      {savingPlanId === store.id ? "Saving..." : "Save plan"}
                    </Button>
                    {!canMutate ? <p className="text-xs text-muted-foreground">Admin action required</p> : null}
                  </div>
                  <p className={billingPlanErrorByStore[store.id] ? "text-xs text-destructive sm:col-span-2" : "text-xs text-muted-foreground sm:col-span-2"}>
                    {billingPlanErrorByStore[store.id] ??
                      (selectedPlan
                        ? `${(selectedPlan.transaction_fee_bps / 100).toFixed(2)}% + $${(selectedPlan.transaction_fee_fixed_cents / 100).toFixed(2)} per successful order.`
                        : "Plan determines the platform fee charged on successful orders.")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Pending Review" description="Apply reasoned governance actions to stores waiting for approval.">
        {pendingStores.length === 0 && !loading ? <p className="text-sm text-muted-foreground">No stores are waiting for review.</p> : null}
        <div className="space-y-3">
          {pendingStores.map((store) => {
            const isHighlighted = store.id === highlightedStoreId;
            return (
              <div
                key={store.id}
                ref={isHighlighted ? highlightedStoreRef : null}
                className={isHighlighted ? "space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3" : "space-y-2 rounded-md border border-border/70 bg-muted/15 p-3"}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {store.name} <span className="text-muted-foreground">({store.slug})</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {new Date(store.created_at).toLocaleString()} · Owner {store.owner.display_name ?? store.owner.email ?? "Unknown owner"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isHighlighted ? (
                      <Button type="button" size="sm" variant="outline" onClick={clearHighlightedStore} disabled={savingId === store.id}>
                        Clear
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/stores/${store.slug}`}>Open workspace</Link>
                    </Button>
                    {canMutate ? (
                      <>
                        <Button type="button" size="sm" onClick={() => void act(store.id, "approve")} disabled={savingId === store.id}>
                          Approve
                        </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void act(store.id, "request_changes")} disabled={savingId === store.id}>
                      Request changes
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void act(store.id, "reject")} disabled={savingId === store.id}>
                      Reject
                    </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => void act(store.id, "suspend")} disabled={savingId === store.id}>
                          Suspend
                        </Button>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Admin action required</p>
                    )}
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-[220px_minmax(0,1fr)]">
                  <label className="text-xs">
                    <span className="mb-1 block font-medium text-muted-foreground">Reason code</span>
                    <select
                      className="h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm"
                      value={reasonCodeByStore[store.id] ?? fallbackReasonCode}
                      onChange={(event) =>
                        setReasonCodeByStore((current) => ({
                          ...current,
                          [store.id]: event.target.value as StoreGovernanceReasonCode
                        }))
                      }
                      disabled={!canMutate || savingId === store.id}
                    >
                      {STORE_GOVERNANCE_REASON_CODES.map((code) => (
                        <option key={code} value={code}>
                          {STORE_GOVERNANCE_REASON_LABELS[code]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs">
                    <span className="mb-1 block font-medium text-muted-foreground">Reason detail (optional)</span>
                    <input
                      className="h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm"
                      value={reasonDetailByStore[store.id] ?? ""}
                      onChange={(event) =>
                        setReasonDetailByStore((current) => ({
                          ...current,
                          [store.id]: event.target.value
                        }))
                      }
                      placeholder="Share context visible in governance history."
                      disabled={!canMutate || savingId === store.id}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </section>
  );
}
