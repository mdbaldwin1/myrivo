import { describe, expect, test } from "vitest";
import { buildHealthScore } from "@/lib/dashboard/store-dashboard/build-health-score";

describe("buildHealthScore", () => {
  test("returns full score when all checks are ready", () => {
    const result = buildHealthScore({
      storeSlug: "my-store",
      hasStripeAccount: true,
      hasVerifiedPrimaryDomain: true,
      activeProductCount: 2,
      hasCheckoutConfigured: true,
      hasSeoTitle: true,
      hasSeoDescription: true,
      hasSupportEmail: true
    });

    expect(result.score).toBe(100);
    expect(result.checks.every((check) => check.status === "ready")).toBe(true);
  });

  test("subtracts check weights when requirements are missing", () => {
    const result = buildHealthScore({
      storeSlug: "my-store",
      hasStripeAccount: false,
      hasVerifiedPrimaryDomain: true,
      activeProductCount: 0,
      hasCheckoutConfigured: false,
      hasSeoTitle: true,
      hasSeoDescription: false,
      hasSupportEmail: false
    });

    expect(result.score).toBe(20);
    expect(result.checks.find((check) => check.id === "payments")?.status).toBe("action_needed");
    expect(result.checks.find((check) => check.id === "domain")?.status).toBe("ready");
  });
});
