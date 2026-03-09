import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  getServerEnv: vi.fn(() => ({
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
    REVIEWS_MEDIA_MAX_IMAGES_PER_REVIEW: "6",
    REVIEWS_MEDIA_MAX_FILE_SIZE_BYTES: "4194304",
    REVIEWS_MEDIA_MAX_WIDTH: "4096",
    REVIEWS_MEDIA_MAX_HEIGHT: "3072"
  }))
}));

import {
  buildReviewDraftMediaPrefix,
  buildReviewMediaPath,
  clampReviewMediaSortOrder,
  isReviewMediaPathForStoreDraft,
  resolveReviewMediaLimits,
  sortAndReindexDraftReviewMediaAssets,
  validateReviewMediaDimensions
} from "@/lib/reviews/media";

describe("review media helpers", () => {
  it("reads media limits from env with defaults", () => {
    const limits = resolveReviewMediaLimits();

    expect(limits.maxImagesPerReview).toBe(6);
    expect(limits.maxFileSizeBytes).toBe(4 * 1024 * 1024);
    expect(limits.maxImageWidth).toBe(4096);
    expect(limits.maxImageHeight).toBe(3072);
  });

  it("builds deterministic draft prefix and storage path", () => {
    const prefix = buildReviewDraftMediaPrefix("store-1", "Draft 123 !!");
    expect(prefix).toBe("store-1/drafts/draft123");

    const path = buildReviewMediaPath({
      storeId: "store-1",
      draftId: "Draft 123 !!",
      sortOrder: 3,
      mimeType: "image/jpeg"
    });

    expect(path.startsWith("store-1/drafts/draft123/003-")).toBe(true);
    expect(path.endsWith(".jpg")).toBe(true);
  });

  it("validates path ownership for a store draft", () => {
    const owned = "store-1/drafts/draft-a/001-file.jpg";
    const wrongStore = "store-2/drafts/draft-a/001-file.jpg";

    expect(isReviewMediaPathForStoreDraft(owned, "store-1", "draft-a")).toBe(true);
    expect(isReviewMediaPathForStoreDraft(wrongStore, "store-1", "draft-a")).toBe(false);
  });

  it("clamps sort order and reindexes deterministically", () => {
    const clamped = clampReviewMediaSortOrder(99, 4);
    expect(clamped).toBe(3);

    const sorted = sortAndReindexDraftReviewMediaAssets(
      [
        {
          storagePath: "store-1/drafts/d-1/010-c.jpg",
          publicUrl: "https://example.com/c.jpg",
          sortOrder: 10,
          mimeType: "image/jpeg",
          sizeBytes: 100
        },
        {
          storagePath: "store-1/drafts/d-1/001-a.jpg",
          publicUrl: "https://example.com/a.jpg",
          sortOrder: 1,
          mimeType: "image/jpeg",
          sizeBytes: 100
        },
        {
          storagePath: "store-1/drafts/d-1/001-b.jpg",
          publicUrl: "https://example.com/b.jpg",
          sortOrder: 1,
          mimeType: "image/jpeg",
          sizeBytes: 100
        }
      ],
      8
    );

    expect(sorted.map((item) => item.storagePath)).toEqual([
      "store-1/drafts/d-1/001-a.jpg",
      "store-1/drafts/d-1/001-b.jpg",
      "store-1/drafts/d-1/010-c.jpg"
    ]);
    expect(sorted.map((item) => item.sortOrder)).toEqual([0, 1, 2]);
  });

  it("enforces dimension limits", () => {
    expect(validateReviewMediaDimensions({}, { maxImageWidth: 6000, maxImageHeight: 6000 }).ok).toBe(true);

    const valid = validateReviewMediaDimensions({ width: 2048, height: 2048 }, { maxImageWidth: 6000, maxImageHeight: 6000 });
    expect(valid.ok).toBe(true);

    const invalid = validateReviewMediaDimensions(
      { width: 7000, height: 2048 },
      { maxImageWidth: 6000, maxImageHeight: 6000 }
    );
    expect(invalid.ok).toBe(false);
  });
});
