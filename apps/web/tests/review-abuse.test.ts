import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  getServerEnv: vi.fn(() => ({
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
    REVIEWS_MAX_SUBMISSIONS_PER_IP_PER_HOUR: "9",
    REVIEWS_MAX_SUBMISSIONS_PER_EMAIL_PER_DAY: "6",
    REVIEWS_BLOCKED_TERMS: "spamword,badlink"
  }))
}));

import { buildReviewFingerprint, evaluateReviewForModeration, normalizeReviewText, resolveReviewAbuseConfig } from "@/lib/reviews/abuse";
import { enforceReviewSubmissionRateLimits, getRequestIpAddress, hashReviewSignal } from "@/lib/reviews/abuse";

function createRateLimitAdminMock(counts: { ipCount?: number; emailCount?: number }) {
  let queryIndex = 0;

  return {
    from: vi.fn(() => ({
      select: vi.fn(() => {
        queryIndex += 1;
        const currentQuery = queryIndex;
        return {
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn(async () => ({
            count: currentQuery === 2 ? counts.emailCount ?? 0 : counts.ipCount ?? 0,
            error: null
          })),
          contains: vi.fn().mockReturnThis()
        };
      })
    }))
  } as unknown as Parameters<typeof enforceReviewSubmissionRateLimits>[0]["admin"];
}

describe("review abuse helpers", () => {
  it("normalizes review text consistently", () => {
    expect(normalizeReviewText("  Hello   WORLD  ")).toBe("hello world");
    expect(normalizeReviewText(null)).toBe("");
  });

  it("reads abuse config from env with fallbacks", () => {
    const config = resolveReviewAbuseConfig();
    expect(config.maxSubmissionsPerIpPerHour).toBe(9);
    expect(config.maxSubmissionsPerEmailPerDay).toBe(6);
    expect(config.blockedTerms).toEqual(["spamword", "badlink"]);
  });

  it("creates deterministic fingerprints", () => {
    const first = buildReviewFingerprint({
      storeId: "store-1",
      productId: "product-1",
      reviewerEmail: "Buyer@Email.com",
      title: "Great",
      body: "Loved it"
    });

    const second = buildReviewFingerprint({
      storeId: "store-1",
      productId: "product-1",
      reviewerEmail: "buyer@email.com",
      title: " great  ",
      body: "  loved   it "
    });

    expect(first).toBe(second);
  });

  it("flags blocked terms and suspicious patterns for moderation", () => {
    const result = evaluateReviewForModeration({
      storeId: "store-1",
      productId: "product-1",
      reviewerEmail: "test@example.com",
      reviewerName: "Test",
      title: "SPAMWORD",
      body: "THIS IS ALL CAPS https://example.com https://example2.com"
    });

    expect(result.holdForModeration).toBe(true);
    expect(result.reasons).toContain("contains_blocked_term");
    expect(result.reasons).toContain("contains_multiple_urls");
    expect(result.reasons).toContain("suspicious_reviewer_name");
  });

  it("returns clean review as not held", () => {
    const result = evaluateReviewForModeration({
      storeId: "store-1",
      reviewerEmail: "buyer@example.com",
      reviewerName: "Maya",
      title: "Lovely product",
      body: "Shipping was fast and quality is great."
    });

    expect(result.holdForModeration).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it("extracts request IP from forwarded headers and hashes signals", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.10, 10.0.0.1"
    });

    expect(getRequestIpAddress(headers)).toBe("203.0.113.10");
    expect(hashReviewSignal("203.0.113.10")).toHaveLength(24);
    expect(hashReviewSignal("")).toBeNull();
  });

  it("enforces rate limits by IP and email deterministically", async () => {
    const ipLimited = await enforceReviewSubmissionRateLimits({
      admin: createRateLimitAdminMock({ ipCount: 9, emailCount: 1 }),
      storeId: "store-1",
      reviewerEmail: "buyer@example.com",
      ipHash: "hashed-ip"
    });
    expect(ipLimited.ok).toBe(false);
    if (!ipLimited.ok) {
      expect(ipLimited.code).toBe("REVIEWS_RATE_LIMIT_IP");
    }

    const emailLimited = await enforceReviewSubmissionRateLimits({
      admin: createRateLimitAdminMock({ ipCount: 0, emailCount: 6 }),
      storeId: "store-1",
      reviewerEmail: "buyer@example.com",
      ipHash: "hashed-ip"
    });
    expect(emailLimited.ok).toBe(false);
    if (!emailLimited.ok) {
      expect(emailLimited.code).toBe("REVIEWS_RATE_LIMIT_EMAIL");
    }

    const allowed = await enforceReviewSubmissionRateLimits({
      admin: createRateLimitAdminMock({ ipCount: 1, emailCount: 1 }),
      storeId: "store-1",
      reviewerEmail: "buyer@example.com",
      ipHash: "hashed-ip"
    });
    expect(allowed.ok).toBe(true);
  });
});
