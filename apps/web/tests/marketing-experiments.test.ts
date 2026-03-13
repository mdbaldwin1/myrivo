import { describe, expect, test } from "vitest";
import { getMarketingExperimentVariantPayload, resolveMarketingExperimentAssignments } from "@/lib/marketing/experiments";

describe("marketing experiments", () => {
  test("keeps assignments stable for a session and page", () => {
    const first = resolveMarketingExperimentAssignments({
      pageKey: "home",
      sessionKey: "session-123"
    });
    const second = resolveMarketingExperimentAssignments({
      pageKey: "home",
      sessionKey: "session-123"
    });

    expect(first).toEqual(second);
    expect(["start_free", "create_account"]).toContain(first.homepage_primary_cta_copy);
  });

  test("returns payload for the resolved variant", () => {
    expect(
      getMarketingExperimentVariantPayload({
        experimentKey: "homepage_primary_cta_copy",
        variantKey: "create_account"
      })
    ).toEqual({ label: "Create account" });
  });
});
