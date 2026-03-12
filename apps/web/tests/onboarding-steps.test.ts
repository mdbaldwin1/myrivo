import { describe, expect, test } from "vitest";
import { getOnboardingNextStep } from "@/lib/stores/onboarding-steps";
import type { StoreOnboardingProgress } from "@/lib/stores/onboarding";

function makeProgress(overrides: Partial<StoreOnboardingProgress> = {}): StoreOnboardingProgress {
  return {
    id: "store-1",
    name: "At Home Apothecary",
    slug: "at-home-apothecary",
    status: "draft",
    role: "owner",
    canManageWorkspace: true,
    canLaunch: true,
    steps: {
      profile: true,
      branding: true,
      firstProduct: true,
      payments: true,
      launch: false
    },
    completedStepCount: 4,
    totalStepCount: 5,
    launchReady: true,
    ...overrides
  };
}

describe("onboarding step routes", () => {
  test("routes branding to Storefront Studio brand editor", () => {
    const nextStep = getOnboardingNextStep(
      makeProgress({
        steps: {
          profile: true,
          branding: false,
          firstProduct: false,
          payments: false,
          launch: false
        }
      })
    );

    expect(nextStep).toEqual({
      id: "branding",
      label: "Set branding",
      href: "/dashboard/stores/at-home-apothecary/storefront-studio?editor=brand"
    });
  });

  test("routes launch to general settings submit-for-review flow", () => {
    const nextStep = getOnboardingNextStep(makeProgress());

    expect(nextStep).toEqual({
      id: "launch",
      label: "Submit for review",
      href: "/dashboard/stores/at-home-apothecary/store-settings/general"
    });
  });

  test("hides launch next step while store is pending review", () => {
    const nextStep = getOnboardingNextStep(
      makeProgress({
        status: "pending_review"
      })
    );

    expect(nextStep).toBeNull();
  });
});
