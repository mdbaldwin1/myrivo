import { beforeEach, describe, expect, test, vi } from "vitest";

const generatePrivacyMetadataMock = vi.fn();
const generateTermsMetadataMock = vi.fn();

vi.mock("@/app/privacy/page", () => ({
  __esModule: true,
  generateMetadata: generatePrivacyMetadataMock
}));

vi.mock("@/app/terms/page", () => ({
  __esModule: true,
  generateMetadata: generateTermsMetadataMock
}));

beforeEach(() => {
  generatePrivacyMetadataMock.mockReset();
  generateTermsMetadataMock.mockReset();
  generatePrivacyMetadataMock.mockResolvedValue({ title: "Privacy" });
  generateTermsMetadataMock.mockResolvedValue({ title: "Terms" });
});

describe("storefront legal route canonicalization", () => {
  test("/s/[slug]/privacy delegates metadata generation with store search params", async () => {
    const page = await import("@/app/s/[slug]/privacy/page");

    const result = await page.generateMetadata({ params: Promise.resolve({ slug: "at-home-apothecary" }) });

    expect(result).toEqual({ title: "Privacy" });
    expect(generatePrivacyMetadataMock).toHaveBeenCalledWith({
      searchParams: expect.any(Promise)
    });
    await expect(generatePrivacyMetadataMock.mock.calls[0]?.[0]?.searchParams).resolves.toEqual({ store: "at-home-apothecary" });
  });

  test("/s/[slug]/terms delegates metadata generation with store search params", async () => {
    const page = await import("@/app/s/[slug]/terms/page");

    const result = await page.generateMetadata({ params: Promise.resolve({ slug: "at-home-apothecary" }) });

    expect(result).toEqual({ title: "Terms" });
    expect(generateTermsMetadataMock).toHaveBeenCalledWith({
      searchParams: expect.any(Promise)
    });
    await expect(generateTermsMetadataMock.mock.calls[0]?.[0]?.searchParams).resolves.toEqual({ store: "at-home-apothecary" });
  });
});
