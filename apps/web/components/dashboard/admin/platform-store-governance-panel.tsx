"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { STORE_GOVERNANCE_REASON_CODES, STORE_GOVERNANCE_REASON_LABELS, type StoreGovernanceReasonCode } from "@/lib/platform/store-governance";

type GovernanceResponse = {
  role: "user" | "support" | "admin";
  pendingStores: Array<{
    id: string;
    name: string;
    slug: string;
    status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed";
    created_at: string;
  }>;
  decisions: Array<{
    id: string;
    at: string;
    action: string;
    reasonCode: StoreGovernanceReasonCode | null;
    reasonLabel: string | null;
    reasonDetail: string | null;
    store: { id: string; name: string; slug: string; status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed" };
    actor: { id: string; displayName: string | null; email: string | null };
  }>;
  error?: string;
};

export function PlatformStoreGovernancePanel() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GovernanceResponse | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reasonCodeByStore, setReasonCodeByStore] = useState<Record<string, StoreGovernanceReasonCode>>({});
  const [reasonDetailByStore, setReasonDetailByStore] = useState<Record<string, string>>({});
  const highlightedStoreId = searchParams.get("storeId");
  const highlightedStoreRef = useRef<HTMLDivElement | null>(null);

  async function fetchGovernanceData() {
    const response = await fetch("/api/platform/stores/governance", { cache: "no-store" });
    const payload = (await response.json()) as GovernanceResponse;
    if (!response.ok) {
      return { data: null, error: payload.error ?? "Unable to load governance data." };
    }
    return { data: payload, error: null };
  }

  async function load() {
    const payload = await fetchGovernanceData();
    if (payload.error) {
      setError(payload.error);
      setLoading(false);
      return;
    }
    setData(payload.data);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    void fetchGovernanceData().then((payload) => {
      if (cancelled) {
        return;
      }
      if (payload.error) {
        setError(payload.error);
      } else {
        setData(payload.data);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const canMutate = data?.role === "admin";

  const fallbackReasonCode = useMemo<StoreGovernanceReasonCode>(() => "incomplete_setup", []);

  useEffect(() => {
    if (!highlightedStoreId || !highlightedStoreRef.current) {
      return;
    }
    highlightedStoreRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightedStoreId, data?.pendingStores]);

  function clearHighlightedStore() {
    if (!highlightedStoreId) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("storeId");
    const nextSearch = nextParams.toString();
    router.replace(nextSearch ? `${pathname}?${nextSearch}` : pathname, { scroll: false });
  }

  async function act(storeId: string, action: "approve" | "reject" | "suspend") {
    if (!canMutate || savingId) {
      return;
    }
    const reasonCode = reasonCodeByStore[storeId] ?? fallbackReasonCode;
    const reason = reasonDetailByStore[storeId]?.trim() || undefined;
    const body = action === "approve" ? { action } : { action, reasonCode, reason };

    setSavingId(storeId);
    setError(null);
    const response = await fetch(`/api/platform/stores/${storeId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Unable to update store status.");
      setSavingId(null);
      return;
    }
    setSavingId(null);
    await load();
  }

  return (
    <section className="space-y-4">
      <SectionCard title="Approval Queue" description="Review pending stores and apply reasoned governance actions.">
        {loading ? <p className="text-sm text-muted-foreground">Loading governance queue...</p> : null}
        <AppAlert variant="error" message={error} className="mb-2" />
        {data && data.pendingStores.length === 0 ? <p className="text-sm text-muted-foreground">No stores are waiting for review.</p> : null}
        <div className="space-y-3">
          {(data?.pendingStores ?? []).map((store) => {
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
                  <p className="text-xs text-muted-foreground">Submitted {new Date(store.created_at).toLocaleString()}</p>
                </div>
                {canMutate ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {isHighlighted ? (
                      <Button type="button" size="sm" variant="outline" onClick={clearHighlightedStore} disabled={savingId === store.id}>
                        Clear
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" onClick={() => void act(store.id, "approve")} disabled={savingId === store.id}>
                      Approve
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void act(store.id, "reject")} disabled={savingId === store.id}>
                      Reject
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void act(store.id, "suspend")} disabled={savingId === store.id}>
                      Suspend
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Admin action required</p>
                )}
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

      <SectionCard title="Recent Decisions" description="Latest governance actions with reason codes and actor context.">
        {data && data.decisions.length === 0 ? <p className="text-sm text-muted-foreground">No governance decisions yet.</p> : null}
        <div className="space-y-2">
          {(data?.decisions ?? []).slice(0, 30).map((decision) => (
            <div key={decision.id} className="rounded-md border border-border/70 px-3 py-2 text-sm">
              <p className="font-medium">
                {decision.store.name} <span className="text-muted-foreground">({decision.store.slug})</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {decision.action} · {new Date(decision.at).toLocaleString()} · {decision.actor.displayName ?? decision.actor.email ?? "Unknown actor"}
              </p>
              <p className="text-xs text-muted-foreground">
                {decision.reasonLabel ?? "No reason code"}
                {decision.reasonDetail ? ` — ${decision.reasonDetail}` : ""}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>
    </section>
  );
}
