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

    expect(redirectToActiveStoreWorkspaceMock).toHaveBeenCalledWith("/content-workspace");
  });

  test("legacy store settings root redirects to the canonical settings root", async () => {
    const page = await import("@/app/dashboard/store-settings/page");

    await page.default();

    expect(redirectToActiveStoreWorkspaceMock).toHaveBeenCalledWith("/store-settings");
  });

  test("slugged content studio root redirects to canonical content workspace root", async () => {
    const page = await import("@/app/dashboard/stores/[storeSlug]/content-studio/page");

    await page.default({ params: Promise.resolve({ storeSlug: "olive-mercantile" }) });

    expect(redirectMock).toHaveBeenCalledWith("/dashboard/stores/olive-mercantile/content-workspace");
  });
});
