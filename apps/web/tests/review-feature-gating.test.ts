import { describe, expect, test } from "vitest";
import { isReviewsEnabledForStoreSlug, resolveReviewsRolloutConfig } from "@/lib/reviews/feature-gating";

describe("reviews rollout feature gating", () => {
  test("defaults to globally enabled with empty allowlist", () => {
    const config = resolveReviewsRolloutConfig({});
    expect(config.enabled).toBe(true);
    expect(config.allowlist.size).toBe(0);
    expect(isReviewsEnabledForStoreSlug("my-store", {})).toBe(true);
  });

  test("disables all stores when feature toggle is off", () => {
    expect(
      isReviewsEnabledForStoreSlug("my-store", {
        REVIEWS_FEATURE_ENABLED: "false",
        REVIEWS_ROLLOUT_STORE_SLUGS: "my-store,other-store"
      })
    ).toBe(false);
  });

  test("supports store allowlist matching", () => {
    const env = {
      REVIEWS_FEATURE_ENABLED: "true",
      REVIEWS_ROLLOUT_STORE_SLUGS: "alpha-store, beta-store"
    };

    expect(isReviewsEnabledForStoreSlug("alpha-store", env)).toBe(true);
    expect(isReviewsEnabledForStoreSlug("BETA-STORE", env)).toBe(true);
    expect(isReviewsEnabledForStoreSlug("gamma-store", env)).toBe(false);
  });
});

