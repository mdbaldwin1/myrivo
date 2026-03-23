import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/http/api-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import {
  deleteReviewMediaObjects,
  ensureReviewMediaBucket,
  isReviewMediaPathForStoreDraft,
  listReviewDraftMediaAssets,
  normalizeReviewMediaPaths,
  resolveActiveStoreBySlug
} from "@/lib/reviews/media";
import { isReviewsEnabledForStoreSlug } from "@/lib/reviews/feature-gating";
import { logReviewUploadError } from "@/lib/reviews/telemetry";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";

const bodySchema = z.object({
  storeSlug: z.string().trim().min(1).max(120),
  reviewDraftId: z.string().trim().min(1).max(64),
  storagePaths: z.array(z.string().trim().min(1).max(1024)).max(100).optional()
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
  if (!isReviewsEnabledForStoreSlug(payload.storeSlug)) {
    return fail(404, "Reviews are not enabled for this store.");
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
      stage: "cleanup",
      reason: "bucket_init_failed",
      draftId: payload.reviewDraftId,
      details: { message: error instanceof Error ? error.message : "bucket init failed" }
    }).catch(() => null);
    return fail(500, error instanceof Error ? error.message : "Unable to initialize review media bucket.");
  }

  let pathsToRemove = normalizeReviewMediaPaths(payload.storagePaths ?? []);

  if (pathsToRemove.length === 0) {
    try {
      const draftAssets = await listReviewDraftMediaAssets(store.id, payload.reviewDraftId);
      pathsToRemove = draftAssets.map((asset) => asset.storagePath);
    } catch (error) {
      void logReviewUploadError({
        storeId: store.id,
        stage: "cleanup",
        reason: "list_draft_media_failed",
        draftId: payload.reviewDraftId,
        details: { message: error instanceof Error ? error.message : "draft list failed" }
      }).catch(() => null);
      return fail(500, error instanceof Error ? error.message : "Unable to list draft media objects for cleanup.");
    }
  }

  for (const path of pathsToRemove) {
    if (!isReviewMediaPathForStoreDraft(path, store.id, payload.reviewDraftId)) {
      return fail(400, "Invalid media storage path for draft cleanup.");
    }
  }

  try {
    await deleteReviewMediaObjects(pathsToRemove);
  } catch (error) {
    void logReviewUploadError({
      storeId: store.id,
      stage: "cleanup",
      reason: "delete_draft_media_failed",
      draftId: payload.reviewDraftId,
      details: { message: error instanceof Error ? error.message : "media delete failed", removeCount: pathsToRemove.length }
    }).catch(() => null);
    return fail(500, error instanceof Error ? error.message : "Unable to remove draft media objects.");
  }

  return ok({
    removedCount: pathsToRemove.length,
    removedPaths: pathsToRemove
  });
}
