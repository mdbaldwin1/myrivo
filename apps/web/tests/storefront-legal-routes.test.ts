import { beforeEach, describe, expect, test, vi } from "vitest";

const redirectMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirectMock(...args)
}));

beforeEach(() => {
  redirectMock.mockReset();
});

describe("storefront legal route canonicalization", () => {
  test("/s/[slug]/privacy redirects into the shared storefront legal route", async () => {
    const page = await import("@/app/s/[slug]/privacy/page");

    await page.default({ params: Promise.resolve({ slug: "at-home-apothecary" }) });

    expect(redirectMock).toHaveBeenCalledWith("/privacy?store=at-home-apothecary");
  });

  test("/s/[slug]/terms redirects into the shared storefront legal route", async () => {
    const page = await import("@/app/s/[slug]/terms/page");

    await page.default({ params: Promise.resolve({ slug: "at-home-apothecary" }) });

    expect(redirectMock).toHaveBeenCalledWith("/terms?store=at-home-apothecary");
  });
});
