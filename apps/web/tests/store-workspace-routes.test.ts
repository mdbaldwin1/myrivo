import { describe, expect, test } from "vitest";
import {
  isDashboardOnboardingPath,
  getStoreSlugFromDashboardPathname,
  isStoreWorkspacePath,
  resolveCurrentStoreWorkspaceSlug
} from "@/lib/routes/store-workspace";

describe("store workspace route helpers", () => {
  test("extracts the store slug from dashboard workspace paths", () => {
    expect(getStoreSlugFromDashboardPathname("/dashboard/stores/at-home-apothecary-2")).toBe("at-home-apothecary-2");
    expect(getStoreSlugFromDashboardPathname("/dashboard/stores/at-home-apothecary-2/orders")).toBe("at-home-apothecary-2");
  });

  test("prefers the route slug over the fallback active store slug", () => {
    expect(resolveCurrentStoreWorkspaceSlug("/dashboard/stores/at-home-apothecary-2/orders", "at-home-apothecary")).toBe(
      "at-home-apothecary-2"
    );
  });

  test("falls back to the active store slug when the current path is not store-scoped", () => {
    expect(resolveCurrentStoreWorkspaceSlug("/dashboard", "at-home-apothecary")).toBe("at-home-apothecary");
  });

  test("detects whether a pathname belongs to a specific store workspace", () => {
    expect(isStoreWorkspacePath("/dashboard/stores/at-home-apothecary-2", "at-home-apothecary-2")).toBe(true);
    expect(isStoreWorkspacePath("/dashboard/stores/at-home-apothecary-2/orders", "at-home-apothecary-2")).toBe(true);
    expect(isStoreWorkspacePath("/dashboard/stores/at-home-apothecary-2/orders", "at-home-apothecary")).toBe(false);
  });

  test("detects focused onboarding routes", () => {
    expect(isDashboardOnboardingPath("/dashboard/stores/onboarding/new")).toBe(true);
    expect(isDashboardOnboardingPath("/dashboard/stores/margies-flower-shop/onboarding")).toBe(true);
    expect(isDashboardOnboardingPath("/dashboard/stores/margies-flower-shop/onboarding/reveal")).toBe(true);
    expect(isDashboardOnboardingPath("/dashboard/stores/margies-flower-shop")).toBe(false);
  });
});
