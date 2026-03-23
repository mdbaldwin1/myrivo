"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlatformAccessibilityReportsPanel } from "@/components/dashboard/admin/platform-accessibility-reports-panel";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";

type PlatformConsoleProps = {
  currentGlobalRole: "user" | "support" | "admin";
};

type PlatformOverviewResponse = {
  stores: Array<{
    id: string;
    name: string;
    slug: string;
    status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed";
    created_at: string;
  }>;
  error?: string;
};

export function PlatformConsole({ currentGlobalRole }: PlatformConsoleProps) {
  const [loading, setLoading] = useState(true);
  const [savingStoreId, setSavingStoreId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<PlatformOverviewResponse | null>(null);
  const pendingReviewStores = overview?.stores.filter((store) => store.status === "pending_review") ?? [];

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/platform/overview", { cache: "no-store" });
      const payload = (await response.json()) as PlatformOverviewResponse;
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setError(payload.error ?? "Unable to load platform overview.");
        setLoading(false);
        return;
      }
      setOverview(payload);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function reviewStore(storeId: string, action: "approve" | "request_changes" | "reject" | "suspend") {
    setSavingStoreId(storeId);
    setError(null);
    const response = await fetch(`/api/platform/stores/${storeId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const payload = (await response.json()) as { store?: PlatformOverviewResponse["stores"][number]; error?: string };
    if (!response.ok || !payload.store) {
      setError(payload.error ?? "Unable to update store status.");
      setSavingStoreId(null);
      return;
    }
    setOverview((current) =>
      current
        ? {
            ...current,
            stores: current.stores.map((entry) => (entry.id === storeId ? payload.store! : entry))
          }
        : current
    );
    setSavingStoreId(null);
  }

  return (
    <section className="space-y-4">
      <SectionCard
        title="Approval Queue"
        description="Review the stores that still need a platform decision, then move deeper work to Stores."
        action={
          <Button type="button" size="sm" variant="brand" asChild>
            <Link href="/dashboard/admin/stores">Open Stores</Link>
          </Button>
        }
      >
        <AppAlert variant="error" message={error} className="mb-2" />
        {loading ? <p className="text-sm text-muted-foreground">Loading approval queue...</p> : null}
        {overview ? (
          pendingReviewStores.length > 0 ? (
            <div className="space-y-2 text-sm">
              {pendingReviewStores.map((store) => (
                <div key={`queue-${store.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 px-3 py-2">
                  <div>
                    <p className="font-medium">
                      {store.name} <span className="text-muted-foreground">({store.slug})</span>
                    </p>
                    <p className="text-xs text-muted-foreground">Created {new Date(store.created_at).toLocaleString()}</p>
                  </div>
                  {currentGlobalRole === "admin" ? (
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" onClick={() => void reviewStore(store.id, "approve")} disabled={savingStoreId === store.id}>
                        Approve
                      </Button>
                      <Link href="/dashboard/admin/stores" className="text-xs font-medium text-primary hover:underline">
                        Open in Stores
                      </Link>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Admin approval required</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No stores pending review.</p>
          )
        ) : null}
      </SectionCard>

      <PlatformAccessibilityReportsPanel />
    </section>
  );
}
