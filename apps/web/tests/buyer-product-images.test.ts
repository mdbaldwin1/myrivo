import { describe, expect, test } from "vitest";
import { resolveBuyerProductImages } from "@/lib/storefront/buyer-product-images";

describe("buyer-facing product imagery", () => {
  test("never exposes a digital product's own uploaded artwork", () => {
    // Uploaded images for a digital product can be the file being sold, and
    // every buyer surface is one right-click from a free copy.
    expect(
      resolveBuyerProductImages({
        productType: "digital",
        digitalPreviewUrl: "https://cdn.test/watermarked.jpg",
        candidates: ["https://cdn.test/original-artwork.jpg"],
      }),
    ).toEqual(["https://cdn.test/watermarked.jpg"]);
  });

  test("shows nothing rather than the original when no preview exists yet", () => {
    expect(
      resolveBuyerProductImages({
        productType: "digital",
        digitalPreviewUrl: null,
        candidates: ["https://cdn.test/original-artwork.jpg"],
      }),
    ).toEqual([]);
  });

  test("leaves physical products with their own imagery, de-duplicated in order", () => {
    expect(
      resolveBuyerProductImages({
        productType: "physical",
        digitalPreviewUrl: null,
        candidates: ["https://cdn.test/a.jpg", null, "https://cdn.test/a.jpg", undefined, "https://cdn.test/b.jpg"],
      }),
    ).toEqual(["https://cdn.test/a.jpg", "https://cdn.test/b.jpg"]);
  });

  test("treats an unspecified product type as physical", () => {
    expect(
      resolveBuyerProductImages({ productType: null, digitalPreviewUrl: null, candidates: ["https://cdn.test/a.jpg"] }),
    ).toEqual(["https://cdn.test/a.jpg"]);
  });
});
