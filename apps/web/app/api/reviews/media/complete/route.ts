import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/http/api-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import {
  REVIEW_MEDIA_ALLOWED_MIME,
  clampReviewMediaSortOrder,
  ensureReviewMediaBucket,
  isReviewMediaPathForStoreDraft,
  listReviewDraftMediaAssets,
  resolveActiveStoreBySlug,
  resolveReviewMediaLimits,
  sortAndReindexDraftReviewMediaAssets,
  validateReviewMediaDimensions
} from "@/lib/reviews/media";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";

const mediaItemSchema = z.object({
  storagePath: z.string().trim().min(1).max(1024),
  sortOrder: z.number().int().min(0).max(100).optional(),
  mimeType: z.string().trim().min(1).optional(),
  sizeBytes: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional()
});

const bodySchema = z.object({
  storeSlug: z.string().trim().min(1).max(120),
  reviewDraftId: z.string().trim().min(1).max(64),
  media: z.array(mediaItemSchema).min(1).max(20)
});

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const parsed = await parseJsonRequest(request, bodySchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const payload = parsed.data;
  const limits = resolveReviewMediaLimits();
  if (payload.media.length > limits.maxImagesPerReview) {
    return fail(400, `Maximum ${limits.maxImagesPerReview} images allowed per review.`);
  }

  const store = await resolveActiveStoreBySlug(payload.storeSlug);
  if (!store) {
    return fail(404, "Store not found.");
  }

  for (const media of payload.media) {
    if (!isReviewMediaPathForStoreDraft(media.storagePath, store.id, payload.reviewDraftId)) {
      return fail(400, "Invalid media storage path for draft.");
    }
    if (media.mimeType && !REVIEW_MEDIA_ALLOWED_MIME.has(media.mimeType)) {
      return fail(400, "Unsupported file type. Use PNG, JPEG, or WEBP.");
    }
    if (media.sizeBytes && media.sizeBytes > limits.maxFileSizeBytes) {
      return fail(400, `Image must be ${limits.maxFileSizeBytes} bytes or smaller.`);
    }

    const dimensionsCheck = validateReviewMediaDimensions(
      { width: media.width, height: media.height },
      { maxImageWidth: limits.maxImageWidth, maxImageHeight: limits.maxImageHeight }
    );
    if (!dimensionsCheck.ok) {
      return fail(400, dimensionsCheck.error);
    }
  }

  try {
    await ensureReviewMediaBucket();
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Unable to initialize review media bucket.");
  }

  let draftAssets;
  try {
    draftAssets = await listReviewDraftMediaAssets(store.id, payload.reviewDraftId);
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Unable to read uploaded draft media.");
  }

  const draftAssetMap = new Map(draftAssets.map((asset) => [asset.storagePath, asset]));
  const selected = [];

  for (const media of payload.media) {
    const existing = draftAssetMap.get(media.storagePath);
    if (!existing) {
      return fail(400, "One or more media objects are missing from uploaded draft assets.");
    }

    selected.push({
      ...existing,
      sortOrder: clampReviewMediaSortOrder(media.sortOrder ?? existing.sortOrder, limits.maxImagesPerReview),
      mimeType: media.mimeType ?? existing.mimeType,
      sizeBytes: media.sizeBytes ?? existing.sizeBytes
    });
  }

  const normalizedMedia = sortAndReindexDraftReviewMediaAssets(selected, limits.maxImagesPerReview);

  return ok({
    media: normalizedMedia,
    limits
  });
}
