"use client";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { DashboardPageScaffold } from "@/components/dashboard/dashboard-page-scaffold";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { Flyout } from "@/components/ui/flyout";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { notify } from "@/lib/feedback/toast";
import { ContextHelpLink } from "@/components/dashboard/context-help-link";
import { getReviewMedia, getReviewResponses, normalizeReviewCollection, normalizeReviewNestedArrays } from "@/lib/reviews/moderation";

type ReviewStatus = "pending" | "published" | "rejected";
type ModerationAction = "publish" | "reject" | "restore";
type MediaAction = "hide" | "remove" | "restore";

type ReviewMedia = {
  id: string;
  public_url: string;
  status: "active" | "hidden" | "removed";
  moderation_reason: string | null;
};

type ReviewResponse = {
  id: string;
  body: string;
};

export type ReviewRow = {
  id: string;
  product_id: string | null;
  reviewer_name: string | null;
  reviewer_email: string;
  rating: number;
  title: string | null;
  body: string | null;
  verified_purchase: boolean;
  status: ReviewStatus;
  moderation_reason: string | null;
  created_at: string;
  review_media: ReviewMedia[] | null;
  review_responses: ReviewResponse[] | null;
};

type ReviewsResponse = {
  items: ReviewRow[];
  error?: string;
};

type ReviewsModerationManagerProps = {
  storeSlug: string;
  initialItems: ReviewRow[];
  initialReviewId?: string | null;
};

export function ReviewsModerationManager({ storeSlug, initialItems, initialReviewId = null }: ReviewsModerationManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const normalizedInitialItems = normalizeReviewCollection(initialItems);
  const initialSelectedReview = initialReviewId ? normalizedInitialItems.find((item) => item.id === initialReviewId) ?? null : null;

  const [items, setItems] = useState(() => normalizedInitialItems);
  const [statusTab, setStatusTab] = useState<"all" | ReviewStatus>("pending");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [verifiedFilter, setVerifiedFilter] = useState<"all" | "true" | "false">("all");
  const [mediaFilter, setMediaFilter] = useState<"all" | "true" | "false">("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedReviewIds, setSelectedReviewIds] = useState<string[]>([]);
  const [selectedReview, setSelectedReview] = useState<ReviewRow | null>(initialSelectedReview);
  const [rejectReason, setRejectReason] = useState("");
  const [responseBody, setResponseBody] = useState(() => getReviewResponses(initialSelectedReview)[0]?.body ?? "");
  const [error, setError] = useState<string | null>(null);

  function updateReviewUrl(reviewId: string | null) {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (reviewId) {
      nextParams.set("reviewId", reviewId);
    } else {
      nextParams.delete("reviewId");
    }
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }

  function openReview(review: ReviewRow | null) {
    const normalized = review ? normalizeReviewNestedArrays(review) : null;
    setSelectedReview(normalized);
    setResponseBody(getReviewResponses(normalized)[0]?.body ?? "");
    updateReviewUrl(normalized?.id ?? null);
  }

  const productOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (item.product_id) {
        map.set(item.product_id, item.title?.trim() || "Product review");
      }
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [items]);

  async function loadQueue(overrides?: { status?: "all" | ReviewStatus }) {
    setLoading(true);
    setError(null);

    const nextStatus = overrides?.status ?? statusTab;
    const params = new URLSearchParams({ storeSlug, status: nextStatus, limit: "100", offset: "0" });
    if (ratingFilter !== "all") params.set("rating", ratingFilter);
    if (verifiedFilter !== "all") params.set("verified", verifiedFilter);
    if (mediaFilter !== "all") params.set("hasMedia", mediaFilter);
    if (productFilter !== "all") params.set("productId", productFilter);

    const response = await fetch(`/api/dashboard/reviews?${params.toString()}`, { cache: "no-store" });
    const payload = (await response.json()) as ReviewsResponse;

    if (!response.ok) {
      setError(payload.error ?? "Unable to load reviews moderation queue.");
      setLoading(false);
      return;
    }

    const nextItems = normalizeReviewCollection(payload.items ?? []);
    setItems(nextItems);
    setSelectedReviewIds([]);
    if (selectedReview) {
      const refreshed = nextItems.find((item) => item.id === selectedReview.id) ?? null;
      openReview(refreshed);
    }
    setLoading(false);
  }

  function syncSelectedReview(nextItems: ReviewRow[]) {
    setSelectedReview((current) => {
      if (!current) {
        return null;
      }
      const refreshed = nextItems.find((item) => item.id === current.id) ?? null;
      setResponseBody(getReviewResponses(refreshed)[0]?.body ?? "");
      return refreshed;
    });
  }

  function applyOptimisticReviewUpdate(reviewId: string, action: ModerationAction, reason?: string) {
    const previous = items;
    const nextStatus: ReviewStatus = action === "reject" ? "rejected" : "published";
    const nextItems = items.map((item) =>
      item.id === reviewId
        ? {
            ...item,
            status: nextStatus,
            moderation_reason: action === "reject" ? reason ?? "rejected" : null
          }
        : item
    );
    setItems(nextItems);
    syncSelectedReview(nextItems);
    return previous;
  }

  async function moderateReview(reviewId: string, action: ModerationAction, reason?: string) {
    const previous = applyOptimisticReviewUpdate(reviewId, action, reason);
    const response = await fetch(`/api/dashboard/reviews/${reviewId}/moderation`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason, storeSlug })
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setItems(previous);
      syncSelectedReview(previous);
      throw new Error(payload.error ?? "Unable to update review moderation status.");
    }
  }

  async function applyBulkAction(action: ModerationAction) {
    if (selectedReviewIds.length === 0 || saving) {
      return;
    }
    if (action === "reject" && !rejectReason.trim()) {
      setError("Reject reason is required for bulk reject.");
      return;
    }

    setSaving(true);
    setError(null);

    const failures: string[] = [];
    for (const reviewId of selectedReviewIds) {
      try {
        await moderateReview(reviewId, action, action === "reject" ? rejectReason.trim() : undefined);
      } catch (err) {
        failures.push(reviewId);
        setError(err instanceof Error ? err.message : "Unable to update one or more reviews.");
      }
    }

    setSelectedReviewIds(failures);
    setSaving(false);
    if (failures.length === 0) {
      notify.success("Bulk moderation update applied.");
    }
  }

  async function moderateMedia(mediaId: string, action: MediaAction) {
    if (!selectedReview || saving) {
      return;
    }

    setSaving(true);
    setError(null);

    const previousItems = items;
    const nextMediaStatus: ReviewMedia["status"] = action === "hide" ? "hidden" : action === "remove" ? "removed" : "active";
    const nextItems = items.map((item) =>
      item.id === selectedReview.id
        ? {
            ...item,
            review_media: getReviewMedia(item).map((media) => (media.id === mediaId ? { ...media, status: nextMediaStatus } : media))
          }
        : item
    );

    setItems(nextItems);
    syncSelectedReview(nextItems);

    const response = await fetch(`/api/dashboard/reviews/${selectedReview.id}/media/${mediaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, storeSlug })
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setItems(previousItems);
      syncSelectedReview(previousItems);
      setError(payload.error ?? "Unable to moderate review media.");
    }

    setSaving(false);
  }

  async function saveResponse() {
    if (!selectedReview || !responseBody.trim()) {
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch(`/api/dashboard/reviews/${selectedReview.id}/response`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: responseBody.trim(), storeSlug })
    });
    const payload = (await response.json().catch(() => ({}))) as { response?: ReviewResponse; error?: string };

    if (!response.ok || !payload.response) {
      setError(payload.error ?? "Unable to save owner response.");
      setSaving(false);
      return;
    }

    const nextItems = items.map((item) =>
      item.id === selectedReview.id
        ? {
            ...item,
            review_responses: [payload.response!]
          }
        : item
    );
    setItems(nextItems);
    syncSelectedReview(nextItems);
    notify.success("Owner response saved.");
    setSaving(false);
  }

  async function deleteResponse() {
    if (!selectedReview || getReviewResponses(selectedReview).length === 0) {
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch(`/api/dashboard/reviews/${selectedReview.id}/response`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeSlug })
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Unable to delete owner response.");
      setSaving(false);
      return;
    }

    const nextItems = items.map((item) => (item.id === selectedReview.id ? { ...item, review_responses: [] } : item));
    setItems(nextItems);
    syncSelectedReview(nextItems);
    notify.success("Owner response removed.");
    setSaving(false);
  }

  const statusCounts = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc[item.status] += 1;
        return acc;
      },
      { pending: 0, published: 0, rejected: 0 } as Record<ReviewStatus, number>
    );
  }, [items]);

  return (
    <DashboardPageScaffold
      title="Reviews Moderation"
      description="Process review queue, moderate review media, and respond directly to customers."
      className="p-3"
      action={
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void loadQueue()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          <ContextHelpLink
            href="/docs/moderation-workflows-and-escalation#moderation-queue-triage"
            context="store_reviews_moderation"
            storeSlug={storeSlug}
            label="Review Moderation Docs"
          />
        </div>
      }
    >
      <AppAlert variant="error" message={error} />

      <div className="rounded-md border border-border/70 bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["pending", "published", "rejected"] as ReviewStatus[]).map((status) => (
            <Button
              key={status}
              type="button"
              size="sm"
              variant={statusTab === status ? "default" : "outline"}
              onClick={() => {
                setStatusTab(status);
                void loadQueue({ status });
              }}
            >
              {status} ({statusCounts[status]})
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant={statusTab === "all" ? "default" : "outline"}
            onClick={() => {
              setStatusTab("all");
              void loadQueue({ status: "all" });
            }}
          >
            all ({items.length})
          </Button>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-5">
          <Select value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value)}>
            <option value="all">All ratings</option>
            <option value="5">5 stars</option>
            <option value="4">4 stars</option>
            <option value="3">3 stars</option>
            <option value="2">2 stars</option>
            <option value="1">1 star</option>
          </Select>
          <Select value={verifiedFilter} onChange={(event) => setVerifiedFilter(event.target.value as "all" | "true" | "false")}>
            <option value="all">Verified + unverified</option>
            <option value="true">Verified only</option>
            <option value="false">Unverified only</option>
          </Select>
          <Select value={mediaFilter} onChange={(event) => setMediaFilter(event.target.value as "all" | "true" | "false")}>
            <option value="all">With/without media</option>
            <option value="true">Has media</option>
            <option value="false">No media</option>
          </Select>
          <Select value={productFilter} onChange={(event) => setProductFilter(event.target.value)}>
            <option value="all">All products</option>
            {productOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
          <Button type="button" size="sm" onClick={() => void loadQueue()} disabled={loading}>
            Apply Filters
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-background p-2">
          <Input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Reject reason for bulk action" />
          <Button type="button" size="sm" onClick={() => void applyBulkAction("publish")} disabled={saving || selectedReviewIds.length === 0}>
            Publish Selected
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void applyBulkAction("reject")} disabled={saving || selectedReviewIds.length === 0}>
            Reject Selected
          </Button>
          <span className="text-xs text-muted-foreground">Selected: {selectedReviewIds.length}</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader className="bg-muted/45">
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={items.length > 0 && selectedReviewIds.length === items.length}
                  onChange={(event) => setSelectedReviewIds(event.target.checked ? items.map((item) => item.id) : [])}
                />
              </TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Reviewer</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Verified</TableHead>
              <TableHead>Media</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-sm text-muted-foreground">
                  No reviews for the selected queue and filters.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedReviewIds.includes(item.id)}
                      onChange={(event) =>
                        setSelectedReviewIds((current) =>
                          event.target.checked ? Array.from(new Set([...current, item.id])) : current.filter((id) => id !== item.id)
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>{new Date(item.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <p className="font-medium">{item.reviewer_name || item.reviewer_email}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{item.title || "Untitled review"}</p>
                  </TableCell>
                  <TableCell>{item.rating}</TableCell>
                  <TableCell>{item.status}</TableCell>
                  <TableCell>{item.verified_purchase ? "yes" : "no"}</TableCell>
                  <TableCell>{getReviewMedia(item).filter((media) => media.status === "active").length}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openReview(item)}
                      >
                        Open
                      </Button>
                      <Button type="button" size="sm" onClick={() => void moderateReview(item.id, "publish")} disabled={saving}>
                        Publish
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void moderateReview(item.id, "reject", rejectReason.trim() || "Rejected by owner moderation")}
                        disabled={saving}
                      >
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Flyout
        open={Boolean(selectedReview)}
        onOpenChange={(open) => {
          if (!open) {
            openReview(null);
          }
        }}
        title="Review Detail"
        className="max-w-3xl"
      >
        {selectedReview ? (
          <div className="space-y-4 text-sm">
            <div className="rounded-md border border-border/70 bg-background p-3">
              <p className="font-medium">{selectedReview.title || "Untitled review"}</p>
              <p className="text-xs text-muted-foreground">
                {selectedReview.reviewer_name || selectedReview.reviewer_email} · {selectedReview.rating} stars · {selectedReview.status}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{selectedReview.body || "No body."}</p>
            </div>

            <div className="space-y-2">
              <p className="font-medium">Media Moderation</p>
              {getReviewMedia(selectedReview).length === 0 ? <p className="text-xs text-muted-foreground">No review media attached.</p> : null}
              <div className="grid gap-3 sm:grid-cols-2">
                {getReviewMedia(selectedReview).map((media) => (
                  <div key={media.id} className="rounded-md border border-border/70 p-2">
                    <div className="relative h-32 w-full overflow-hidden rounded">
                      <Image src={media.public_url} alt="Review media" fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" unoptimized />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Status: {media.status}</p>
                    <div className="mt-2 flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => void moderateMedia(media.id, "restore")} disabled={saving}>
                        Restore
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => void moderateMedia(media.id, "hide")} disabled={saving}>
                        Hide
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => void moderateMedia(media.id, "remove")} disabled={saving}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-medium">Owner Response</p>
              <textarea
                className="min-h-28 w-full rounded-md border border-border/70 bg-background px-2 py-2 text-sm"
                value={responseBody}
                onChange={(event) => setResponseBody(event.target.value)}
                placeholder="Write an owner response to this published review"
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={() => void saveResponse()} disabled={saving || selectedReview.status !== "published"}>
                  Save Response
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void deleteResponse()}
                  disabled={saving || getReviewResponses(selectedReview).length === 0}
                >
                  Remove Response
                </Button>
              </div>
              {selectedReview.status !== "published" ? (
                <p className="text-xs text-muted-foreground">Response editing is enabled only for published reviews.</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </Flyout>
    </DashboardPageScaffold>
  );
}
