import { describe, expect, test } from "vitest";
import { getLaunchReadinessChecklistItems, getOnboardingNextStep } from "@/lib/stores/onboarding-steps";
import type { StoreOnboardingProgress } from "@/lib/stores/onboarding";

function makeProgress(overrides: Partial<StoreOnboardingProgress> = {}): StoreOnboardingProgress {
  return {
    id: "store-1",
    name: "Sunset Mercantile",
    slug: "sunset-mercantile",
    status: "draft",
    hasLaunchedOnce: false,
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
      label: "Polish the storefront",
      href: "/dashboard/stores/sunset-mercantile/storefront-studio?editor=brand"
    });
  });

  test("routes launch back to the store overview go-live flow", () => {
    const nextStep = getOnboardingNextStep(makeProgress());

    expect(nextStep).toEqual({
      id: "launch",
      label: "Get ready to launch",
      href: "/dashboard/stores/sunset-mercantile"
    });
  });

  test("builds launch-readiness checklist items with merchant-facing labels", () => {
    const items = getLaunchReadinessChecklistItems(
      makeProgress({
        steps: {
          profile: false,
          branding: true,
          firstProduct: false,
          payments: false,
          launch: false
        },
        completedStepCount: 1
      })
    );

    expect(items).toEqual([
      expect.objectContaining({
        id: "details",
        label: "Review store details",
        href: "/dashboard/stores/sunset-mercantile/store-settings/general",
        completed: false
      }),
      expect.objectContaining({
        id: "firstProduct",
        label: "Add your first product",
        href: "/dashboard/stores/sunset-mercantile/catalog",
        completed: false
      }),
      expect.objectContaining({
        id: "payments",
        label: "Connect payments",
        href: "/dashboard/stores/sunset-mercantile/store-settings/integrations",
        completed: false
      }),
      expect.objectContaining({
        id: "launch",
        label: "Go live",
        href: "/dashboard/stores/sunset-mercantile",
        completed: false
      })
    ]);
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
