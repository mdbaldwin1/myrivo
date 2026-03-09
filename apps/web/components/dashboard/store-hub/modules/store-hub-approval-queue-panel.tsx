"use client";

import { useState } from "react";
import Link from "next/link";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import type { StoreHubData } from "@/lib/dashboard/store-hub/store-hub-types";

type StoreHubApprovalQueuePanelProps = {
  initialItems: StoreHubData["approvalQueue"];
  canApprove: boolean;
};

export function StoreHubApprovalQueuePanel({ initialItems, canApprove }: StoreHubApprovalQueuePanelProps) {
  const [items, setItems] = useState(initialItems);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAction(storeId: string, action: "approve") {
    if (!canApprove || savingId) {
      return;
    }
    setSavingId(storeId);
    setError(null);
    const response = await fetch(`/api/platform/stores/${storeId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Unable to update store status.");
      setSavingId(null);
      return;
    }
    setItems((current) => current.filter((item) => item.id !== storeId));
    setSavingId(null);
  }

  return (
    <SectionCard title="Approval Queue" description="Stores pending review before going live.">
      <div className="space-y-2">
        <AppAlert variant="error" message={error} />
        {items.length === 0 ? <p className="text-sm text-muted-foreground">No stores pending review.</p> : null}
        {items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/15 px-3 py-2 text-sm">
            <div>
              <p className="font-medium">
                {item.name} <span className="text-muted-foreground">({item.slug})</span>
              </p>
              <p className="text-xs text-muted-foreground">Submitted {new Date(item.createdAt).toLocaleString()}</p>
            </div>
            {canApprove ? (
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" disabled={savingId === item.id} onClick={() => void runAction(item.id, "approve")}>
                  Approve
                </Button>
                <Link href="/dashboard/admin/stores" className="text-xs font-medium text-primary hover:underline">
                  Reasoned Actions
                </Link>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Admin approval required</span>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
