import { describe, expect, test } from "vitest";
import { isReviewsEnabledForStoreSlug, resolveReviewsRolloutConfig } from "@/lib/reviews/feature-gating";

describe("reviews rollout feature gating", () => {
  test("defaults to globally enabled with empty allowlist", () => {
    const config = resolveReviewsRolloutConfig({});
    expect(config.allowlist.size).toBe(0);
    expect(isReviewsEnabledForStoreSlug("my-store", {})).toBe(true);
  });

  test("supports store allowlist matching", () => {
    const env = {
      REVIEWS_ROLLOUT_STORE_SLUGS: "alpha-store, beta-store"
    };

    expect(isReviewsEnabledForStoreSlug("alpha-store", env)).toBe(true);
    expect(isReviewsEnabledForStoreSlug("BETA-STORE", env)).toBe(true);
    expect(isReviewsEnabledForStoreSlug("gamma-store", env)).toBe(false);
  });
});
