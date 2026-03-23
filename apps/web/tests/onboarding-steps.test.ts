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
    paymentStatus: "ready",
    taxCollectionMode: "stripe_tax",
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
        paymentStatus: "not_connected",
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

  test("uses Stripe setup language when payments are connected but not ready", () => {
    const nextStep = getOnboardingNextStep(
      makeProgress({
        paymentStatus: "setup_required",
        steps: {
          profile: true,
          branding: true,
          firstProduct: true,
          payments: false,
          launch: false
        },
        launchReady: false
      })
    );

    expect(nextStep).toEqual({
      id: "payments",
      label: "Finish Stripe tax setup",
      href: "/dashboard/stores/sunset-mercantile/store-settings/integrations"
    });

    const items = getLaunchReadinessChecklistItems(
      makeProgress({
        paymentStatus: "setup_required",
        steps: {
          profile: true,
          branding: true,
          firstProduct: true,
          payments: false,
          launch: false
        },
        launchReady: false
      })
    );

    expect(items[2]).toEqual(
      expect.objectContaining({
        id: "payments",
        label: "Finish Stripe tax setup",
        completed: false
      })
    );
  });

  test("uses tax decision language when Stripe is connected but the seller has not chosen a tax path", () => {
    const nextStep = getOnboardingNextStep(
      makeProgress({
        paymentStatus: "tax_decision_required",
        taxCollectionMode: "unconfigured",
        steps: {
          profile: true,
          branding: true,
          firstProduct: true,
          payments: false,
          launch: false
        },
        launchReady: false
      })
    );

    expect(nextStep).toEqual({
      id: "payments",
      label: "Choose tax handling",
      href: "/dashboard/stores/sunset-mercantile/store-settings/integrations"
    });

    const items = getLaunchReadinessChecklistItems(
      makeProgress({
        paymentStatus: "tax_decision_required",
        taxCollectionMode: "unconfigured",
        steps: {
          profile: true,
          branding: true,
          firstProduct: true,
          payments: false,
          launch: false
        },
        launchReady: false
      })
    );

    expect(items[2]).toEqual(
      expect.objectContaining({
        id: "payments",
        label: "Choose tax handling",
        completed: false
      })
    );
  });

  test("uses payments-ready language for seller-attested no-tax stores", () => {
    const items = getLaunchReadinessChecklistItems(
      makeProgress({
        paymentStatus: "ready",
        taxCollectionMode: "seller_attested_no_tax",
        steps: {
          profile: true,
          branding: true,
          firstProduct: true,
          payments: true,
          launch: false
        },
        launchReady: true
      })
    );

    expect(items[2]).toEqual(
      expect.objectContaining({
        id: "payments",
        label: "Payments ready",
        description: "Stripe payments are ready, and you recorded a no-tax selling decision.",
        completed: true
      })
    );
  });
});
