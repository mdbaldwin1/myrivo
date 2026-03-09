"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppAlert } from "@/components/ui/app-alert";
import { SectionCard } from "@/components/ui/section-card";

type ReviewsHealthResponse = {
  summary: {
    submissionsLast7d: number;
    approvalsLast7d: number;
    rejectionsLast7d: number;
    lowStarLast7d: number;
    pendingQueueDepth: number;
    pendingAvgAgeHours: number;
    pendingOldestAgeHours: number;
    uploadFailuresLast7d: number;
  };
  recentUploadFailures: Array<{
    id: string;
    storeId: string | null;
    createdAt: string;
    stage: string;
    reason: string;
    message: string | null;
  }>;
  error?: string;
};

export function PlatformReviewsHealthPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReviewsHealthResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/platform/reviews/health", { cache: "no-store" });
      const payload = (await response.json()) as ReviewsHealthResponse;
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setError(payload.error ?? "Unable to load reviews health.");
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

  return (
    <SectionCard title="Reviews Pipeline Health" description="Operational counters, queue latency, and upload-failure telemetry.">
      <AppAlert variant="error" message={error} />
      {loading ? <p className="text-sm text-muted-foreground">Loading review health metrics...</p> : null}

      {data ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="rounded-md border border-border/70 bg-background p-3">
              <p className="font-medium">Submissions (7d)</p>
              <p className="text-2xl font-semibold">{data.summary.submissionsLast7d}</p>
            </div>
            <div className="rounded-md border border-border/70 bg-background p-3">
              <p className="font-medium">Approvals / Rejections (7d)</p>
              <p className="text-2xl font-semibold">{data.summary.approvalsLast7d} / {data.summary.rejectionsLast7d}</p>
            </div>
            <div className="rounded-md border border-border/70 bg-background p-3">
              <p className="font-medium">Low Star (7d)</p>
              <p className="text-2xl font-semibold">{data.summary.lowStarLast7d}</p>
            </div>
            <div className="rounded-md border border-border/70 bg-background p-3">
              <p className="font-medium">Upload Failures (7d)</p>
              <p className="text-2xl font-semibold">{data.summary.uploadFailuresLast7d}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded-md border border-border/70 bg-background p-3">
              <p className="font-medium">Pending Queue Depth</p>
              <p className="text-2xl font-semibold">{data.summary.pendingQueueDepth}</p>
            </div>
            <div className="rounded-md border border-border/70 bg-background p-3">
              <p className="font-medium">Queue Latency (hours)</p>
              <p className="text-muted-foreground">Avg: {data.summary.pendingAvgAgeHours}</p>
              <p className="text-muted-foreground">Oldest: {data.summary.pendingOldestAgeHours}</p>
            </div>
          </div>

          <div className="rounded-md border border-border/70 bg-background p-3">
            <p className="font-medium text-sm">Recent Upload Errors</p>
            {data.recentUploadFailures.length === 0 ? <p className="text-xs text-muted-foreground">No upload errors in the latest window.</p> : null}
            <div className="space-y-1">
              {data.recentUploadFailures.map((item) => (
                <p key={item.id} className="text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString()} · stage={item.stage} · reason={item.reason}
                  {item.message ? ` · ${item.message}` : ""}
                </p>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Follow incident triage steps in <Link href="/docs/moderation-workflows-and-escalation" className="text-primary hover:underline">moderation docs</Link> and
            <span> </span>
            <Link href="/docs/audit-explorer-and-evidence#evidence-export-playbook" className="text-primary hover:underline">audit evidence playbook</Link>.
          </p>
        </div>
      ) : null}
    </SectionCard>
  );
}
