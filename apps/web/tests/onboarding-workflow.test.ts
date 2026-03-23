import { describe, expect, test } from "vitest";
import {
  createDefaultOnboardingAnswers,
  getNextOnboardingWorkflowStep,
  getOnboardingWorkflowStepIndex,
  getPreviousOnboardingWorkflowStep,
  normalizeOnboardingAnswers
} from "@/lib/onboarding/workflow";

describe("onboarding workflow helpers", () => {
  test("creates sensible defaults from a store name", () => {
    expect(createDefaultOnboardingAnswers("Sunset Mercantile")).toEqual(
      expect.objectContaining({
        storeIdentity: { storeName: "Sunset Mercantile" },
        branding: expect.objectContaining({ logoAssetPath: null, visualDirection: null }),
        payments: { connectDeferred: true }
      })
    );
  });

  test("normalizes malformed answers into the expected shape", () => {
    expect(
      normalizeOnboardingAnswers(
        {
          storeIdentity: { storeName: "  " },
          branding: { visualDirection: "not-real", visualDirectionSource: "oops" },
          firstProduct: { optionMode: "single_axis", inventoryMode: "invalid" },
          payments: { connectDeferred: false }
        },
        "Sunset Mercantile"
      )
    ).toEqual(
      expect.objectContaining({
        storeIdentity: { storeName: "Sunset Mercantile" },
        branding: expect.objectContaining({ visualDirection: null, visualDirectionSource: null }),
        firstProduct: expect.objectContaining({ optionMode: "single_axis", inventoryMode: "in_stock" }),
        payments: { connectDeferred: true }
      })
    );
  });

  test("moves through the onboarding steps predictably", () => {
    expect(getNextOnboardingWorkflowStep(null)).toBe("logo");
    expect(getNextOnboardingWorkflowStep("logo")).toBe("describeStore");
    expect(getPreviousOnboardingWorkflowStep("describeStore")).toBe("logo");
    expect(getPreviousOnboardingWorkflowStep("logo")).toBe("logo");
    expect(getOnboardingWorkflowStepIndex("review")).toBe(4);
  });
});
