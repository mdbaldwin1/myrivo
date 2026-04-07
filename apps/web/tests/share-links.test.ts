import { describe, expect, test } from "vitest";
import { buildStorefrontShareUrl, normalizeShareDestinationPath } from "@/lib/analytics/share-links";

describe("storefront share links", () => {
  test("builds custom-domain share links with UTM params", () => {
    const url = buildStorefrontShareUrl({
      appUrl: "https://app.myrivo.com",
      storeSlug: "at-home-apothecary",
      primaryDomain: "athomeapothecary.com",
      destinationPath: "/products?view=grid",
      utmSource: "instagram",
      utmMedium: "social",
      utmCampaign: "spring-launch"
    });

    expect(url).toBe("https://athomeapothecary.com/products?view=grid&utm_source=instagram&utm_medium=social&utm_campaign=spring-launch");
  });

  test("falls back to slug storefront routes when no primary domain exists", () => {
    const url = buildStorefrontShareUrl({
      appUrl: "https://app.myrivo.com",
      storeSlug: "at-home-apothecary",
      destinationPath: "/about",
      utmSource: "newsletter"
    });

    expect(url).toBe("https://app.myrivo.com/s/at-home-apothecary/about?utm_source=newsletter");
  });

  test("normalizes full URLs and preserves hashes", () => {
    const url = buildStorefrontShareUrl({
      appUrl: "https://app.myrivo.com",
      storeSlug: "at-home-apothecary",
      primaryDomain: "athomeapothecary.com",
      destinationPath: "https://athomeapothecary.com/products/lip-balm?ref=profile#details",
      utmCampaign: "restock"
    });

    expect(url).toBe("https://athomeapothecary.com/products/lip-balm?ref=profile&utm_campaign=restock#details");
  });

  test("normalizes empty and relative destination paths", () => {
    expect(normalizeShareDestinationPath("")).toBe("/");
    expect(normalizeShareDestinationPath("products")).toBe("/products");
  });
});
