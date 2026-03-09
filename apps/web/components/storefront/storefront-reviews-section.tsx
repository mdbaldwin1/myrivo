"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Plus, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCopyTemplate, type StorefrontCopyConfig } from "@/lib/storefront/copy";
import type { StorefrontThemeConfig } from "@/lib/theme/storefront-theme";
import { cn } from "@/lib/utils";

type ReviewMedia = {
  id: string;
  publicUrl: string;
  sortOrder: number;
};

type ReviewItem = {
  id: string;
  reviewerName: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  verifiedPurchase: boolean;
  createdAt: string;
  media: ReviewMedia[];
};

type ReviewSummary = {
  reviewCount: number;
  averageRating: number;
  ratings: Record<1 | 2 | 3 | 4 | 5, number>;
};

type ReviewsResponse = {
  items: ReviewItem[];
  nextCursor: string | null;
  summary: ReviewSummary;
};

type Props = {
  storeSlug: string;
  productId?: string;
  className?: string;
  buttonRadiusClass?: string;
  reviewCardClassName?: string;
  reviewsTheme: Pick<
    StorefrontThemeConfig,
    | "reviewsEnabled"
    | "reviewsFormEnabled"
    | "reviewsDefaultSort"
    | "reviewsItemsPerPage"
    | "reviewsShowVerifiedBadge"
    | "reviewsShowMediaGallery"
    | "reviewsShowSummary"
  >;
  reviewsCopy: StorefrontCopyConfig["reviews"];
};

type ReviewFormState = {
  reviewerName: string;
  reviewerEmail: string;
  rating: number;
  title: string;
  body: string;
};

type SelectedReviewFile = {
  id: string;
  file: File;
  previewUrl: string;
};

const REVIEW_MAX_IMAGES = 8;

const initialFormState: ReviewFormState = {
  reviewerName: "",
  reviewerEmail: "",
  rating: 5,
  title: "",
  body: ""
};

function formatReviewDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

async function uploadReviewFiles(input: {
  storeSlug: string;
  reviewDraftId: string;
  files: File[];
}) {
  const media: Array<{ storagePath: string; sortOrder: number; mimeType: string; sizeBytes: number; width?: number; height?: number }> = [];

  for (let index = 0; index < input.files.length; index += 1) {
    const file = input.files[index];
    if (!file) {
      continue;
    }
    const uploadResponse = await fetch("/api/reviews/media/upload-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storeSlug: input.storeSlug,
        reviewDraftId: input.reviewDraftId,
        mimeType: file.type,
        sizeBytes: file.size,
        sortOrder: index
      })
    });

    if (!uploadResponse.ok) {
      const payload = (await uploadResponse.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error ?? "Unable to prepare review image upload.");
    }

    const uploadPayload = (await uploadResponse.json()) as { uploadUrl: string; storagePath: string };

    const objectUploadResponse = await fetch(uploadPayload.uploadUrl, {
      method: "PUT",
      headers: {
        "content-type": file.type
      },
      body: file
    });

    if (!objectUploadResponse.ok) {
      throw new Error("Unable to upload review image.");
    }

    media.push({
      storagePath: uploadPayload.storagePath,
      sortOrder: index,
      mimeType: file.type,
      sizeBytes: file.size
    });
  }

  const completeResponse = await fetch("/api/reviews/media/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      storeSlug: input.storeSlug,
      reviewDraftId: input.reviewDraftId,
      media
    })
  });

  if (!completeResponse.ok) {
    const payload = (await completeResponse.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Unable to finalize review media.");
  }

  const completePayload = (await completeResponse.json()) as {
    media: Array<{ storagePath: string; sortOrder: number; mimeType: string | null; sizeBytes: number | null }>;
  };

  return completePayload.media;
}

export function StorefrontReviewsSection({
  storeSlug,
  productId,
  className,
  buttonRadiusClass,
  reviewCardClassName,
  reviewsTheme,
  reviewsCopy
}: Props) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [form, setForm] = useState<ReviewFormState>(initialFormState);
  const [selectedFiles, setSelectedFiles] = useState<SelectedReviewFile[]>([]);
  const [replaceImageIndex, setReplaceImageIndex] = useState<number | null>(null);
  const [draggingImageIndex, setDraggingImageIndex] = useState<number | null>(null);
  const [dragOverImageIndex, setDragOverImageIndex] = useState<number | null>(null);
  const selectedFilesRef = useRef<SelectedReviewFile[]>([]);
  const addImageInputRef = useRef<HTMLInputElement | null>(null);
  const replaceImageInputRef = useRef<HTMLInputElement | null>(null);
  const suppressNextImageClickRef = useRef(false);

  const endpoint = useMemo(() => {
    const limit = Math.max(1, Math.min(50, reviewsTheme.reviewsItemsPerPage));
    const sort = reviewsTheme.reviewsDefaultSort;
    if (productId) {
      return `/api/reviews/product/${productId}?limit=${limit}&sort=${sort}`;
    }
    return `/api/reviews/store/${encodeURIComponent(storeSlug)}?limit=${limit}&sort=${sort}`;
  }, [productId, reviewsTheme.reviewsDefaultSort, reviewsTheme.reviewsItemsPerPage, storeSlug]);

  const loadReviews = useCallback(async (nextCursor: string | null, append: boolean) => {
    setLoading(true);
    setError(null);

    const url = nextCursor ? `${endpoint}&cursor=${encodeURIComponent(nextCursor)}` : endpoint;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? "Unable to load reviews right now.");
      setLoading(false);
      return;
    }

    const payload = (await response.json()) as ReviewsResponse;
    setItems((current) => (append ? [...current, ...payload.items] : payload.items));
    setCursor(payload.nextCursor);
    setSummary(payload.summary);
    setLoading(false);
  }, [endpoint]);

  useEffect(() => {
    void loadReviews(null, false);
  }, [loadReviews]);

  useEffect(() => {
    selectedFilesRef.current = selectedFiles;
  }, [selectedFiles]);

  useEffect(() => {
    return () => {
      for (const entry of selectedFilesRef.current) {
        URL.revokeObjectURL(entry.previewUrl);
      }
    };
  }, []);

  function reorderSelectedFiles(fromIndex: number, toIndex: number) {
    setSelectedFiles((current) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= current.length || toIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) {
        return current;
      }
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function appendFiles(rawFiles: File[]) {
    if (rawFiles.length === 0) {
      return;
    }

    setSelectedFiles((current) => {
      const remaining = Math.max(0, REVIEW_MAX_IMAGES - current.length);
      if (remaining === 0) {
        return current;
      }

      const additions = rawFiles.slice(0, remaining).map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file)
      }));

      return [...current, ...additions];
    });
  }

  function replaceFile(rawFile: File, targetIndex: number) {
    setSelectedFiles((current) =>
      current.map((entry, index) => {
        if (index !== targetIndex) {
          return entry;
        }
        URL.revokeObjectURL(entry.previewUrl);
        return {
          id: crypto.randomUUID(),
          file: rawFile,
          previewUrl: URL.createObjectURL(rawFile)
        };
      })
    );
  }

  function removeFile(targetIndex: number) {
    setSelectedFiles((current) => {
      const removed = current[targetIndex];
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return current.filter((_, index) => index !== targetIndex);
    });
  }

  async function submitReview() {
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    const files = selectedFiles.map((entry) => entry.file);
    const reviewDraftId = files.length > 0 ? crypto.randomUUID() : undefined;

    try {
      const media =
        files.length > 0 && reviewDraftId
          ? await uploadReviewFiles({
              storeSlug,
              reviewDraftId,
              files
            })
          : [];

      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storeSlug,
          reviewType: productId ? "product" : "store",
          productId: productId ?? null,
          reviewDraftId,
          rating: form.rating,
          title: form.title,
          body: form.body,
          reviewerName: form.reviewerName,
          reviewerEmail: form.reviewerEmail,
          media
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Unable to submit review.");
      }

      setForm(initialFormState);
      for (const entry of selectedFiles) {
        URL.revokeObjectURL(entry.previewUrl);
      }
      setSelectedFiles([]);
      setSuccessMessage(reviewsCopy.moderationSuccessMessage);
      await loadReviews(null, false);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to submit review.");
    }

    setSubmitting(false);
  }

  if (!reviewsTheme.reviewsEnabled) {
    return null;
  }

  return (
    <section className={cn("space-y-6 border-t border-border/70 pt-8", className)}>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold [font-family:var(--storefront-font-heading)]">{reviewsCopy.sectionTitle}</h2>
        {summary && reviewsTheme.reviewsShowSummary ? (
          <p className="text-sm text-muted-foreground">
            {formatCopyTemplate(reviewsCopy.summaryTemplate, {
              average: summary.averageRating.toFixed(2),
              count: String(summary.reviewCount)
            })}
          </p>
        ) : null}
      </div>

      <div className="space-y-4">
        {loading ? <p className="text-sm text-muted-foreground">{reviewsCopy.loadingMessage}</p> : null}

        {!loading && items.length === 0 ? <p className="text-sm text-muted-foreground">{reviewsCopy.emptyState}</p> : null}

        {items.map((item) => (
          <article key={item.id} className={cn("space-y-2 rounded-xl border border-border/70 bg-[color:var(--storefront-surface)] p-4", reviewCardClassName)}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <strong>{item.reviewerName || reviewsCopy.anonymousReviewer}</strong>
              <span aria-hidden="true">•</span>
              <span>{"★".repeat(item.rating)}{"☆".repeat(Math.max(0, 5 - item.rating))}</span>
              <span aria-hidden="true">•</span>
              <span className="text-muted-foreground">{formatReviewDate(item.createdAt)}</span>
              {reviewsTheme.reviewsShowVerifiedBadge && item.verifiedPurchase ? (
                <span className="rounded-full border border-border px-2 py-0.5 text-xs">{reviewsCopy.verifiedPurchaseBadge}</span>
              ) : null}
            </div>
            {item.title ? <h3 className="font-medium">{item.title}</h3> : null}
            {item.body ? <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p> : null}
            {reviewsTheme.reviewsShowMediaGallery && item.media.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {item.media.map((media) => (
                  <a key={media.id} href={media.publicUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-border/70">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={media.publicUrl} alt="Review attachment" className="h-24 w-full object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
            ) : null}
          </article>
        ))}

        {cursor ? (
          <Button type="button" variant="outline" onClick={() => void loadReviews(cursor, true)} className={cn("h-10 px-4", buttonRadiusClass)}>
            {reviewsCopy.loadMore}
          </Button>
        ) : null}
      </div>

      {reviewsTheme.reviewsFormEnabled ? (
      <div className={cn("space-y-3 rounded-xl border border-border/70 bg-[color:var(--storefront-surface)] p-4", reviewCardClassName)}>
        <h3 className="text-lg font-semibold">{reviewsCopy.formTitle}</h3>

        <FeedbackMessage type="error" message={error} />
        <FeedbackMessage type="success" message={successMessage} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            value={form.reviewerName}
            onChange={(event) => setForm((current) => ({ ...current, reviewerName: event.target.value }))}
            placeholder={reviewsCopy.namePlaceholder}
            maxLength={120}
          />
          <Input
            value={form.reviewerEmail}
            onChange={(event) => setForm((current) => ({ ...current, reviewerEmail: event.target.value }))}
            placeholder={reviewsCopy.emailPlaceholder}
            type="email"
            maxLength={320}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-[max-content_minmax(0,1fr)]">
          <div className="inline-flex w-fit items-center gap-1 rounded-md border border-input bg-transparent px-2 py-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-label={`${value} star${value === 1 ? "" : "s"}`}
                onClick={() => setForm((current) => ({ ...current, rating: value }))}
                className="text-lg leading-none"
              >
                <Star
                  className={cn("h-4 w-4", value <= form.rating ? "text-amber-500" : "text-muted-foreground")}
                  strokeWidth={1.8}
                  fill={value <= form.rating ? "currentColor" : "none"}
                />
              </button>
            ))}
            <span className="ml-1 text-xs text-muted-foreground">{form.rating}/5</span>
          </div>
          <Input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder={reviewsCopy.titlePlaceholder}
            maxLength={120}
          />
        </div>

        <Textarea
          value={form.body}
          onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
          placeholder={reviewsCopy.bodyPlaceholder}
          rows={4}
          maxLength={5000}
        />

        <div className="space-y-2">
          <input
            ref={addImageInputRef}
            type="file"
            className="hidden"
            multiple
            accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              appendFiles(files);
              event.target.value = "";
            }}
          />
          <input
            ref={replaceImageInputRef}
            type="file"
            className="hidden"
            accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              const targetIndex = replaceImageIndex;
              if (!file || targetIndex === null) {
                event.target.value = "";
                return;
              }
              replaceFile(file, targetIndex);
              setReplaceImageIndex(null);
              event.target.value = "";
            }}
          />

          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((entry, imageIndex) => (
              <div
                key={entry.id}
                className={cn(
                  "group relative h-24 w-24 cursor-grab overflow-hidden rounded-md border border-border bg-muted/15 transition-transform hover:scale-[1.02] active:cursor-grabbing",
                  dragOverImageIndex === imageIndex && draggingImageIndex !== imageIndex ? "ring-2 ring-primary/70 ring-offset-1" : ""
                )}
                draggable
                onDragStart={(event) => {
                  setDraggingImageIndex(imageIndex);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", String(imageIndex));
                }}
                onDragEnd={() => {
                  setDraggingImageIndex(null);
                  setDragOverImageIndex(null);
                  setTimeout(() => {
                    suppressNextImageClickRef.current = false;
                  }, 0);
                }}
                onDragEnter={() => {
                  if (draggingImageIndex !== null && draggingImageIndex !== imageIndex) {
                    setDragOverImageIndex(imageIndex);
                  }
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDragLeave={() => {
                  if (dragOverImageIndex === imageIndex) {
                    setDragOverImageIndex(null);
                  }
                }}
                onDrop={() => {
                  if (draggingImageIndex === null) {
                    return;
                  }
                  suppressNextImageClickRef.current = true;
                  reorderSelectedFiles(draggingImageIndex, imageIndex);
                  setDraggingImageIndex(null);
                  setDragOverImageIndex(null);
                }}
                onClick={() => {
                  if (suppressNextImageClickRef.current) {
                    suppressNextImageClickRef.current = false;
                    return;
                  }
                  setReplaceImageIndex(imageIndex);
                  replaceImageInputRef.current?.click();
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={entry.previewUrl} alt={`Selected review image ${imageIndex + 1}`} className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 bg-black/25 opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <Pencil className="h-4 w-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]" />
                </div>
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-full bg-red-600 p-1 text-white transition hover:bg-red-700"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeFile(imageIndex);
                  }}
                  aria-label="Remove selected image"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            <button
              type="button"
              className="flex h-24 w-24 items-center justify-center rounded-md border border-dashed border-border bg-muted/10 text-muted-foreground transition hover:-translate-y-0.5 hover:border-primary/45 hover:bg-muted/25 hover:text-foreground hover:shadow-sm"
              onClick={() => addImageInputRef.current?.click()}
              aria-label="Upload review image"
              disabled={selectedFiles.length >= REVIEW_MAX_IMAGES}
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatCopyTemplate(reviewsCopy.imageCountTemplate, {
              current: String(selectedFiles.length),
              max: String(REVIEW_MAX_IMAGES)
            })}{" "}
            {reviewsCopy.imageHelperText}
          </p>
        </div>

        <Button
          type="button"
          onClick={() => void submitReview()}
          disabled={submitting || !form.reviewerEmail || !form.body.trim()}
          className={cn("h-10 px-4", buttonRadiusClass)}
        >
          {submitting ? reviewsCopy.submittingButton : reviewsCopy.submitButton}
        </Button>
      </div>
      ) : null}
    </section>
  );
}
