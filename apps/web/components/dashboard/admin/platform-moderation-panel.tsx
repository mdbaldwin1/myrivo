"use client";

import { useEffect, useState } from "react";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";

type ModerationResponse = {
  role: "user" | "support" | "admin";
  summary: {
    pendingReviewsCount: number;
    flaggedMediaCount: number;
  };
  pendingReviews: Array<{
    id: string;
    store_id: string;
    product_id: string | null;
    reviewer_name: string | null;
    reviewer_email: string;
    rating: number;
    title: string | null;
    body: string | null;
    created_at: string;
    store: { id: string; slug: string; name: string } | null;
    product: { id: string; name: string } | null;
    activeMediaCount: number;
  }>;
  flaggedMedia: Array<{
    id: string;
    review_id: string;
    status: "active" | "hidden" | "removed";
    moderation_reason: string | null;
    public_url: string;
    updated_at: string;
    store: { id: string; slug: string; name: string } | null;
  }>;
  error?: string;
};

export function PlatformModerationPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingReviewId, setSavingReviewId] = useState<string | null>(null);
  const [savingMediaId, setSavingMediaId] = useState<string | null>(null);
  const [rejectReasonByReview, setRejectReasonByReview] = useState<Record<string, string>>({});
  const [data, setData] = useState<ModerationResponse | null>(null);

  async function fetchModerationData() {
    const response = await fetch("/api/platform/moderation/queue", { cache: "no-store" });
    const payload = (await response.json()) as ModerationResponse;
    if (!response.ok) {
      return { data: null, error: payload.error ?? "Unable to load moderation queue." };
    }
    return { data: payload, error: null };
  }

  async function load() {
    const payload = await fetchModerationData();
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
    void fetchModerationData().then((payload) => {
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

  const canMutate = data?.role === "support" || data?.role === "admin";

  async function moderateReview(reviewId: string, action: "publish" | "reject") {
    if (!canMutate || savingReviewId) {
      return;
    }
    const reason = rejectReasonByReview[reviewId]?.trim() || undefined;
    if (action === "reject" && !reason) {
      setError("A rejection reason is required.");
      return;
    }
    setSavingReviewId(reviewId);
    setError(null);
    const response = await fetch(`/api/platform/moderation/reviews/${reviewId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason })
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Unable to moderate review.");
      setSavingReviewId(null);
      return;
    }
    setSavingReviewId(null);
    await load();
  }

  async function moderateMedia(mediaId: string, action: "hide" | "remove" | "restore") {
    if (!canMutate || savingMediaId) {
      return;
    }
    setSavingMediaId(mediaId);
    setError(null);
    const response = await fetch(`/api/platform/moderation/media/${mediaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Unable to moderate media.");
      setSavingMediaId(null);
      return;
    }
    setSavingMediaId(null);
    await load();
  }

  return (
    <section className="space-y-4">
      <AppAlert variant="error" message={error} />

      <SectionCard title="Pending Reviews" description="Cross-store queue of reviews awaiting publication decision.">
        {loading ? <p className="text-sm text-muted-foreground">Loading moderation queue...</p> : null}
        {data ? (
          <p className="mb-2 text-xs text-muted-foreground">Pending review count: {data.summary.pendingReviewsCount}</p>
        ) : null}
        {(data?.pendingReviews ?? []).length === 0 && !loading ? <p className="text-sm text-muted-foreground">No pending reviews.</p> : null}
        <div className="space-y-2">
          {(data?.pendingReviews ?? []).map((review) => (
            <div key={review.id} className="rounded-md border border-border/70 px-3 py-2 text-sm">
              <p className="font-medium">
                {review.store?.name ?? "Unknown store"} · {review.product?.name ?? "Store review"}
              </p>
              <p className="text-xs text-muted-foreground">
                {review.rating} stars · {review.reviewer_name ?? review.reviewer_email} · {new Date(review.created_at).toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{review.title ?? "Untitled"}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{review.body ?? ""}</p>
              <p className="mt-1 text-xs text-muted-foreground">Active media: {review.activeMediaCount}</p>
              {canMutate ? (
                <div className="mt-2 space-y-2">
                  <input
                    value={rejectReasonByReview[review.id] ?? ""}
                    onChange={(event) => setRejectReasonByReview((current) => ({ ...current, [review.id]: event.target.value }))}
                    className="h-9 w-full rounded-md border border-border/70 bg-background px-2 text-xs"
                    placeholder="Required for reject (ex: low quality, abuse, policy violation)"
                    disabled={savingReviewId === review.id}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" onClick={() => void moderateReview(review.id, "publish")} disabled={savingReviewId === review.id}>
                      Publish
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void moderateReview(review.id, "reject")} disabled={savingReviewId === review.id}>
                      Reject
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Flagged Media" description="Recently hidden or removed review media across stores.">
        {data ? (
          <p className="mb-2 text-xs text-muted-foreground">Flagged media count: {data.summary.flaggedMediaCount}</p>
        ) : null}
        {(data?.flaggedMedia ?? []).length === 0 && !loading ? <p className="text-sm text-muted-foreground">No flagged media.</p> : null}
        <div className="space-y-2">
          {(data?.flaggedMedia ?? []).map((media) => (
            <div key={media.id} className="rounded-md border border-border/70 px-3 py-2 text-sm">
              <p className="font-medium">{media.store?.name ?? "Unknown store"}</p>
              <p className="text-xs text-muted-foreground">
                {media.status} · {new Date(media.updated_at).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">{media.moderation_reason ?? "No reason recorded"}</p>
              <a href={media.public_url} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary hover:underline">
                Open media
              </a>
              {canMutate ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" onClick={() => void moderateMedia(media.id, "restore")} disabled={savingMediaId === media.id}>
                    Restore
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void moderateMedia(media.id, "hide")} disabled={savingMediaId === media.id}>
                    Hide
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void moderateMedia(media.id, "remove")} disabled={savingMediaId === media.id}>
                    Remove
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </SectionCard>
    </section>
  );
}
