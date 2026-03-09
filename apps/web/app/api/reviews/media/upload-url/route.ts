import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/http/api-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import {
  REVIEW_MEDIA_ALLOWED_MIME,
  buildReviewMediaPath,
  clampReviewMediaSortOrder,
  ensureReviewMediaBucket,
  listReviewDraftMediaAssets,
  resolveActiveStoreBySlug,
  resolveReviewMediaLimits,
  validateReviewMediaDimensions,
  REVIEW_MEDIA_BUCKET
} from "@/lib/reviews/media";
import { logReviewUploadError } from "@/lib/reviews/telemetry";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  storeSlug: z.string().trim().min(1).max(120),
  reviewDraftId: z.string().trim().min(1).max(64),
  mimeType: z.string().trim().min(1),
  sizeBytes: z.number().int().positive(),
  sortOrder: z.number().int().min(0).max(100).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional()
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
  if (!REVIEW_MEDIA_ALLOWED_MIME.has(payload.mimeType)) {
    return fail(400, "Unsupported file type. Use PNG, JPEG, or WEBP.");
  }

  const limits = resolveReviewMediaLimits();
  if (payload.sizeBytes > limits.maxFileSizeBytes) {
    return fail(400, `Image must be ${limits.maxFileSizeBytes} bytes or smaller.`);
  }

  const dimensionsCheck = validateReviewMediaDimensions(
    { width: payload.width, height: payload.height },
    { maxImageWidth: limits.maxImageWidth, maxImageHeight: limits.maxImageHeight }
  );
  if (!dimensionsCheck.ok) {
    return fail(400, dimensionsCheck.error);
  }

  const store = await resolveActiveStoreBySlug(payload.storeSlug);
  if (!store) {
    return fail(404, "Store not found.");
  }

  try {
    await ensureReviewMediaBucket();
  } catch (error) {
    void logReviewUploadError({
      storeId: store.id,
      stage: "upload_url",
      reason: "bucket_init_failed",
      draftId: payload.reviewDraftId,
      details: { message: error instanceof Error ? error.message : "bucket init failed" }
    }).catch(() => null);
    return fail(500, error instanceof Error ? error.message : "Unable to initialize review media bucket.");
  }

  try {
    const existingAssets = await listReviewDraftMediaAssets(store.id, payload.reviewDraftId);
    if (existingAssets.length >= limits.maxImagesPerReview) {
      void logReviewUploadError({
        storeId: store.id,
        stage: "upload_url",
        reason: "max_images_exceeded",
        draftId: payload.reviewDraftId,
        details: { existingCount: existingAssets.length, maxImagesPerReview: limits.maxImagesPerReview }
      }).catch(() => null);
      return fail(400, `Maximum ${limits.maxImagesPerReview} images allowed per review.`);
    }
  } catch (error) {
    void logReviewUploadError({
      storeId: store.id,
      stage: "upload_url",
      reason: "list_draft_media_failed",
      draftId: payload.reviewDraftId,
      details: { message: error instanceof Error ? error.message : "draft media list failed" }
    }).catch(() => null);
    return fail(500, error instanceof Error ? error.message : "Unable to validate draft media state.");
  }

  const storagePath = buildReviewMediaPath({
    storeId: store.id,
    draftId: payload.reviewDraftId,
    sortOrder: clampReviewMediaSortOrder(payload.sortOrder ?? 0, limits.maxImagesPerReview),
    mimeType: payload.mimeType
  });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(REVIEW_MEDIA_BUCKET).createSignedUploadUrl(storagePath);

  if (error || !data?.signedUrl) {
    void logReviewUploadError({
      storeId: store.id,
      stage: "upload_url",
      reason: "signed_url_failed",
      draftId: payload.reviewDraftId,
      details: { message: error?.message ?? "Unable to create signed upload URL." }
    }).catch(() => null);
    return fail(500, error?.message ?? "Unable to create signed upload URL.");
  }

  return ok(
    {
      uploadUrl: data.signedUrl,
      storagePath,
      token: data.token,
      path: data.path,
      expiresInSeconds: 7200,
      limits
    },
    { status: 201 }
  );
}
