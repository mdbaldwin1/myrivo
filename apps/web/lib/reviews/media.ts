import { randomUUID } from "node:crypto";
import { getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isStorePubliclyAccessibleStatus } from "@/lib/stores/lifecycle";

export const REVIEW_MEDIA_BUCKET = "review-media";
export const REVIEW_MEDIA_DEFAULT_MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
export const REVIEW_MEDIA_DEFAULT_MAX_IMAGES_PER_REVIEW = 8;
export const REVIEW_MEDIA_DEFAULT_MAX_IMAGE_WIDTH = 6000;
export const REVIEW_MEDIA_DEFAULT_MAX_IMAGE_HEIGHT = 6000;
export const REVIEW_MEDIA_ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

export type ResolvedStore = {
  id: string;
  slug: string;
};

export type ReviewMediaLimits = {
  maxFileSizeBytes: number;
  maxImagesPerReview: number;
  maxImageWidth: number;
  maxImageHeight: number;
};

export type DraftReviewMediaAsset = {
  storagePath: string;
  publicUrl: string;
  sortOrder: number;
  mimeType: string | null;
  sizeBytes: number | null;
};

function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "bin";
}

function parsePositiveInteger(input: string | undefined, fallback: number, min: number, max: number) {
  if (!input) {
    return fallback;
  }

  const parsed = Number.parseInt(input.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return fallback;
  }

  return parsed;
}

function normalizeSlug(slug: string) {
  return slug.trim().toLowerCase();
}

function normalizeDraftId(draftId: string) {
  return draftId.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);
}

function bytesToMegabytesString(sizeBytes: number) {
  const megabytes = Math.max(1, Math.ceil(sizeBytes / (1024 * 1024)));
  return `${megabytes}MB`;
}

export function resolveReviewMediaLimits(): ReviewMediaLimits {
  const env = getServerEnv();

  const maxFileSizeBytes = parsePositiveInteger(
    env.REVIEWS_MEDIA_MAX_FILE_SIZE_BYTES,
    REVIEW_MEDIA_DEFAULT_MAX_FILE_SIZE_BYTES,
    512 * 1024,
    20 * 1024 * 1024
  );

  return {
    maxFileSizeBytes,
    maxImagesPerReview: parsePositiveInteger(
      env.REVIEWS_MEDIA_MAX_IMAGES_PER_REVIEW,
      REVIEW_MEDIA_DEFAULT_MAX_IMAGES_PER_REVIEW,
      1,
      20
    ),
    maxImageWidth: parsePositiveInteger(
      env.REVIEWS_MEDIA_MAX_WIDTH,
      REVIEW_MEDIA_DEFAULT_MAX_IMAGE_WIDTH,
      500,
      10000
    ),
    maxImageHeight: parsePositiveInteger(
      env.REVIEWS_MEDIA_MAX_HEIGHT,
      REVIEW_MEDIA_DEFAULT_MAX_IMAGE_HEIGHT,
      500,
      10000
    )
  };
}

export function buildReviewDraftMediaPrefix(storeId: string, draftId: string) {
  const safeDraftId = normalizeDraftId(draftId);
  if (!safeDraftId) {
    return null;
  }
  return `${storeId}/drafts/${safeDraftId}`;
}

export function buildReviewMediaPath(input: {
  storeId: string;
  draftId: string;
  sortOrder: number;
  mimeType: string;
}) {
  const safeDraftId = normalizeDraftId(input.draftId) || randomUUID();
  const safeSort = Number.isFinite(input.sortOrder) ? Math.max(0, Math.trunc(input.sortOrder)) : 0;
  const paddedSort = String(safeSort).padStart(3, "0");
  const ext = extensionForMime(input.mimeType);
  return `${input.storeId}/drafts/${safeDraftId}/${paddedSort}-${Date.now()}-${randomUUID()}.${ext}`;
}

export function isReviewMediaPathForStoreDraft(path: string, storeId: string, draftId: string) {
  const normalizedPath = path.trim();
  const prefix = buildReviewDraftMediaPrefix(storeId, draftId);
  if (!prefix || !normalizedPath) {
    return false;
  }
  return normalizedPath.startsWith(`${prefix}/`);
}

export function clampReviewMediaSortOrder(sortOrder: number, maxImagesPerReview: number) {
  if (!Number.isFinite(sortOrder)) {
    return 0;
  }
  return Math.min(Math.max(0, Math.trunc(sortOrder)), Math.max(0, maxImagesPerReview - 1));
}

export function validateReviewMediaDimensions(
  dimensions: { width?: number | null; height?: number | null },
  limits: Pick<ReviewMediaLimits, "maxImageWidth" | "maxImageHeight">
) {
  if (dimensions.width === undefined && dimensions.height === undefined) {
    return { ok: true as const };
  }

  const widthInput = dimensions.width;
  const heightInput = dimensions.height;
  if (widthInput === null || heightInput === null || widthInput === undefined || heightInput === undefined) {
    return { ok: false as const, error: "Image dimensions must include width and height." };
  }

  if (!Number.isFinite(widthInput) || !Number.isFinite(heightInput)) {
    return { ok: false as const, error: "Image dimensions must include width and height." };
  }

  const width = Math.trunc(widthInput);
  const height = Math.trunc(heightInput);
  if (width <= 0 || height <= 0) {
    return { ok: false as const, error: "Image dimensions must be positive integers." };
  }
  if (width > limits.maxImageWidth || height > limits.maxImageHeight) {
    return {
      ok: false as const,
      error: `Image dimensions exceed limit (${limits.maxImageWidth}x${limits.maxImageHeight}px).`
    };
  }

  return { ok: true as const };
}

export async function ensureReviewMediaBucket() {
  const limits = resolveReviewMediaLimits();
  const admin = createSupabaseAdminClient();
  const { data: bucket, error: bucketError } = await admin.storage.getBucket(REVIEW_MEDIA_BUCKET);

  if (bucket) {
    return;
  }

  if (bucketError && !String(bucketError.message).toLowerCase().includes("not found")) {
    throw new Error(bucketError.message);
  }

  const { error: createError } = await admin.storage.createBucket(REVIEW_MEDIA_BUCKET, {
    public: true,
    fileSizeLimit: bytesToMegabytesString(limits.maxFileSizeBytes),
    allowedMimeTypes: [...REVIEW_MEDIA_ALLOWED_MIME]
  });

  if (createError && !String(createError.message).toLowerCase().includes("already exists")) {
    throw new Error(createError.message);
  }
}

export async function resolveActiveStoreBySlug(slug: string): Promise<ResolvedStore | null> {
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedSlug) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("stores")
    .select("id,slug,status")
    .eq("slug", normalizedSlug)
    .maybeSingle<{ id: string; slug: string; status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed" }>();

  if (error || !data || !isStorePubliclyAccessibleStatus(data.status)) {
    return null;
  }

  return { id: data.id, slug: data.slug };
}

export async function deleteReviewMediaObjects(paths: string[]) {
  if (paths.length === 0) {
    return;
  }
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.from(REVIEW_MEDIA_BUCKET).remove(paths);
  if (error) {
    throw new Error(error.message);
  }
}

export function normalizeReviewMediaPaths(paths: string[]) {
  const unique = new Set<string>();
  for (const path of paths) {
    const normalized = path.trim();
    if (!normalized) {
      continue;
    }
    unique.add(normalized);
  }
  return [...unique];
}

export function buildReviewMediaPublicUrl(path: string) {
  const admin = createSupabaseAdminClient();
  return admin.storage.from(REVIEW_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function listReviewDraftMediaAssets(storeId: string, draftId: string): Promise<DraftReviewMediaAsset[]> {
  const prefix = buildReviewDraftMediaPrefix(storeId, draftId);
  if (!prefix) {
    return [];
  }

  const admin = createSupabaseAdminClient();
  const bucket = admin.storage.from(REVIEW_MEDIA_BUCKET);
  const assets: DraftReviewMediaAsset[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await bucket.list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" }
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const entry of data as Array<{ name?: string | null; metadata?: Record<string, unknown> | null }>) {
      if (!entry.name) {
        continue;
      }

      const storagePath = `${prefix}/${entry.name}`;
      const sortMatch = entry.name.match(/^(\d+)-/);
      const sortOrder = sortMatch ? Number.parseInt(sortMatch[1] ?? "0", 10) : 0;
      const metadata = entry.metadata ?? {};
      const mimeType = typeof metadata.mimetype === "string" ? metadata.mimetype : null;
      const sizeBytes = typeof metadata.size === "number" ? metadata.size : null;
      assets.push({
        storagePath,
        publicUrl: buildReviewMediaPublicUrl(storagePath),
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        mimeType,
        sizeBytes
      });
    }

    if (data.length < 100) {
      break;
    }

    offset += 100;
  }

  return assets;
}

export function sortAndReindexDraftReviewMediaAssets(
  assets: DraftReviewMediaAsset[],
  maxImagesPerReview: number
): DraftReviewMediaAsset[] {
  const stableSorted = [...assets].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }
    return left.storagePath.localeCompare(right.storagePath);
  });

  return stableSorted.slice(0, maxImagesPerReview).map((asset, index) => ({
    ...asset,
    sortOrder: index
  }));
}
