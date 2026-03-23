import { beforeEach, describe, expect, test, vi } from "vitest";

const redirectToActiveStoreWorkspaceMock = vi.fn();
const redirectMock = vi.fn();

vi.mock("@/app/dashboard/_lib/legacy-store-route-redirect", () => ({
  redirectToActiveStoreWorkspace: (...args: unknown[]) => redirectToActiveStoreWorkspaceMock(...args)
}));

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirectMock(...args)
}));

beforeEach(() => {
  redirectToActiveStoreWorkspaceMock.mockReset();
  redirectMock.mockReset();
});

describe("dashboard workspace route canonicalization", () => {
  test("legacy content workspace root redirects to the canonical workspace root", async () => {
    const page = await import("@/app/dashboard/content-workspace/page");

    await page.default();

    expect(redirectToActiveStoreWorkspaceMock).toHaveBeenCalledWith("/storefront-studio");
  });

  test("legacy content workspace home route redirects to the canonical studio root", async () => {
    const page = await import("@/app/dashboard/content-workspace/home/page");

    await page.default();

    expect(redirectToActiveStoreWorkspaceMock).toHaveBeenCalledWith("/storefront-studio");
  });

  test("legacy store settings root redirects to the canonical settings root", async () => {
    const page = await import("@/app/dashboard/store-settings/page");

    await page.default();

    expect(redirectToActiveStoreWorkspaceMock).toHaveBeenCalledWith("/store-settings");
  });

  test("slugged content studio root redirects to canonical storefront studio root", async () => {
    const page = await import("@/app/dashboard/stores/[storeSlug]/content-studio/page");

    await page.default({ params: Promise.resolve({ storeSlug: "olive-mercantile" }) });

    expect(redirectMock).toHaveBeenCalledWith("/dashboard/stores/olive-mercantile/storefront-studio");
  });

  test("retired content workspace pages redirect into the matching Studio surface", async () => {
    const pageMatrix = [
      ["@/app/dashboard/stores/[storeSlug]/content-workspace/home/page", null],
      ["@/app/dashboard/stores/[storeSlug]/content-workspace/products/page", "products"],
      ["@/app/dashboard/stores/[storeSlug]/content-workspace/about/page", "about"],
      ["@/app/dashboard/stores/[storeSlug]/content-workspace/policies/page", "policies"],
      ["@/app/dashboard/stores/[storeSlug]/content-workspace/cart/page", "cart"],
      ["@/app/dashboard/stores/[storeSlug]/content-workspace/order-summary/page", "orderSummary"]
    ] as const;

    for (const [modulePath, surface] of pageMatrix) {
      redirectMock.mockReset();
      const page = await import(modulePath);

      await page.default({ params: Promise.resolve({ storeSlug: "olive-mercantile" }) });

      expect(redirectMock).toHaveBeenCalledWith(
        surface ? `/dashboard/stores/olive-mercantile/storefront-studio?surface=${surface}` : "/dashboard/stores/olive-mercantile/storefront-studio"
      );
    }
  });

  test("legacy transactional email routes redirect to Email Studio", async () => {
    const legacyPage = await import("@/app/dashboard/content-workspace/emails/page");
    await legacyPage.default();
    expect(redirectToActiveStoreWorkspaceMock).toHaveBeenCalledWith("/email-studio");

    redirectMock.mockReset();
    const sluggedPage = await import("@/app/dashboard/stores/[storeSlug]/content-workspace/emails/page");
    await sluggedPage.default({ params: Promise.resolve({ storeSlug: "olive-mercantile" }) });
    expect(redirectMock).toHaveBeenCalledWith("/dashboard/stores/olive-mercantile/email-studio");

    redirectMock.mockReset();
    const contentStudioPage = await import("@/app/dashboard/stores/[storeSlug]/content-studio/emails/page");
    await contentStudioPage.default({ params: Promise.resolve({ storeSlug: "olive-mercantile" }) });
    expect(redirectMock).toHaveBeenCalledWith("/dashboard/stores/olive-mercantile/email-studio");
  });
});
