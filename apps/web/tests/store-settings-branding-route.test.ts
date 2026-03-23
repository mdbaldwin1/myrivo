import { beforeEach, describe, expect, test, vi } from "vitest";

const redirectMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirectMock(...args)
}));

describe("store settings branding route", () => {
  beforeEach(() => {
    redirectMock.mockReset();
  });

  test("redirects the retired branding route into Storefront Studio brand editing", async () => {
    const pageModule = await import("@/app/dashboard/stores/[storeSlug]/store-settings/branding/page");

    await pageModule.default({
      params: Promise.resolve({ storeSlug: "olive-mercantile" })
    });

    expect(redirectMock).toHaveBeenCalledWith("/dashboard/stores/olive-mercantile/storefront-studio?editor=brand");
  });
});
