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

  test("still never exposes the artwork when the download is one variant of many", () => {
    // A painting sold as a download, a print, and the original: selecting the
    // download must not reach the uploaded images.
    expect(
      resolveBuyerProductImages({
        productType: "physical",
        variantFulfillmentType: "digital",
        digitalPreviewUrl: "https://cdn.test/watermarked.jpg",
        candidates: ["https://cdn.test/original-artwork.jpg"],
      }),
    ).toEqual(["https://cdn.test/watermarked.jpg"]);
  });

  test("shows the photographs for the variants a buyer can hold", () => {
    expect(
      resolveBuyerProductImages({
        productType: "physical",
        variantFulfillmentType: null,
        digitalPreviewUrl: "https://cdn.test/watermarked.jpg",
        candidates: ["https://cdn.test/painting-photo.jpg"],
      }),
    ).toEqual(["https://cdn.test/painting-photo.jpg"]);
  });

  test("lets a physical variant of a digital product show its own imagery", () => {
    expect(
      resolveBuyerProductImages({
        productType: "digital",
        variantFulfillmentType: "physical",
        digitalPreviewUrl: "https://cdn.test/watermarked.jpg",
        candidates: ["https://cdn.test/print-photo.jpg"],
      }),
    ).toEqual(["https://cdn.test/print-photo.jpg"]);
  });

  test("withholds a product's images only when nothing physical is left to depict", () => {
    // No variant on show, and every variant is a download.
    expect(
      resolveBuyerProductImages({
        productType: "physical",
        variantFulfillmentTypes: ["digital", "digital"],
        digitalPreviewUrl: "https://cdn.test/watermarked.jpg",
        candidates: ["https://cdn.test/original-artwork.jpg"],
      }),
    ).toEqual(["https://cdn.test/watermarked.jpg"]);

    // One physical variant is enough for the photographs to be legitimate.
    expect(
      resolveBuyerProductImages({
        productType: "digital",
        variantFulfillmentTypes: ["digital", "physical"],
        digitalPreviewUrl: "https://cdn.test/watermarked.jpg",
        candidates: ["https://cdn.test/painting-photo.jpg"],
      }),
    ).toEqual(["https://cdn.test/painting-photo.jpg"]);
  });

  test("a selected variant outranks what the rest of the product looks like", () => {
    expect(
      resolveBuyerProductImages({
        productType: "physical",
        variantFulfillmentType: "digital",
        variantFulfillmentTypes: ["digital", "physical"],
        digitalPreviewUrl: "https://cdn.test/watermarked.jpg",
        candidates: ["https://cdn.test/original-artwork.jpg"],
      }),
    ).toEqual(["https://cdn.test/watermarked.jpg"]);
  });
});
