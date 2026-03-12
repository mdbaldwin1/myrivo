"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { notify } from "@/lib/feedback/toast";
import { buildStoreScopedApiPath, getStoreSlugFromDashboardPathname } from "@/lib/routes/store-workspace";
import type { StoreRecord } from "@/types/database";

type StoreResponse = {
  store?: Pick<StoreRecord, "id" | "name" | "slug" | "status">;
  error?: string;
};

type StorePublishSettingsPanelProps = {
  initialStatus: StoreRecord["status"];
};

export function StorePublishSettingsPanel({ initialStatus }: StorePublishSettingsPanelProps) {
  const pathname = usePathname();
  const storeSlug = getStoreSlugFromDashboardPathname(pathname);
  const [status, setStatus] = useState<StoreRecord["status"]>(initialStatus);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusCopy: Record<StoreRecord["status"], string> = {
    draft: "Not visible publicly. Submit for review when you're ready for approval.",
    pending_review: "Waiting for platform approval before going live.",
    active: "Live and visible publicly.",
    suspended: "Hidden from public view by platform review."
  };

  async function handleSubmitForReview() {
    if (status !== "draft" || submittingReview) {
      return;
    }

    setSubmittingReview(true);
    setError(null);

    try {
      const response = await fetch(buildStoreScopedApiPath("/api/stores/current/submit-review", storeSlug), {
        method: "POST"
      });
      const payload = (await response.json()) as StoreResponse;

      if (!response.ok || !payload.store) {
        throw new Error(payload.error ?? "Unable to submit store for review.");
      }

      setStatus(payload.store.status);
      notify.success("Store submitted for review.", {
        description: "Your storefront will go live once approved."
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit store for review.");
    } finally {
      setSubmittingReview(false);
    }
  }

  return (
    <SectionCard title="Publish & Review" description="Store visibility and review workflow belong in Store Settings, not the visual builder.">
      <div className="space-y-3">
        <div className="rounded-md border border-border/70 bg-muted/15 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Store Status</p>
          <p className="mt-1 text-sm font-medium capitalize">{status.replace("_", " ")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{statusCopy[status]}</p>
        </div>

        {status === "draft" ? (
          <Button type="button" variant="outline" onClick={() => void handleSubmitForReview()} disabled={submittingReview}>
            {submittingReview ? "Submitting..." : "Submit for Review"}
          </Button>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </SectionCard>
  );
}
