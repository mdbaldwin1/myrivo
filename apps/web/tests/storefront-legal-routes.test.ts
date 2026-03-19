import { beforeEach, describe, expect, test, vi } from "vitest";

const privacyPageMock = vi.fn();
const termsPageMock = vi.fn();

vi.mock("@/app/privacy/page", () => ({
  __esModule: true,
  default: privacyPageMock
}));

vi.mock("@/app/terms/page", () => ({
  __esModule: true,
  default: termsPageMock
}));

beforeEach(() => {
  privacyPageMock.mockReset();
  termsPageMock.mockReset();
});

describe("storefront legal route canonicalization", () => {
  test("/s/[slug]/privacy reuses the shared storefront legal page with store search params", async () => {
    const page = await import("@/app/s/[slug]/privacy/page");

    await page.default({ params: Promise.resolve({ slug: "at-home-apothecary" }) });

    expect(privacyPageMock).toHaveBeenCalledWith({
      searchParams: expect.any(Promise)
    });
    await expect(privacyPageMock.mock.calls[0]?.[0]?.searchParams).resolves.toEqual({ store: "at-home-apothecary" });
  });

  test("/s/[slug]/terms reuses the shared storefront legal page with store search params", async () => {
    const page = await import("@/app/s/[slug]/terms/page");

    await page.default({ params: Promise.resolve({ slug: "at-home-apothecary" }) });

    expect(termsPageMock).toHaveBeenCalledWith({
      searchParams: expect.any(Promise)
    });
    await expect(termsPageMock.mock.calls[0]?.[0]?.searchParams).resolves.toEqual({ store: "at-home-apothecary" });
  });
});
