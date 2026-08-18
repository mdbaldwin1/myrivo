import { describe, expect, test } from "vitest";
import {
  imageBaseName,
  isWatermarkedProductImage,
  splitWatermarkedPath,
} from "@/lib/digital-products/watermarked-images";

const PUBLIC = "https://project.supabase.co/storage/v1/object/public/store-products";

describe("finding the way back from a watermarked image", () => {
  test("recognises a watermarked copy and leaves ordinary images alone", () => {
    expect(isWatermarkedProductImage(`${PUBLIC}/store-1/product-1/watermarked/artwork.jpg`)).toBe(true);
    expect(isWatermarkedProductImage(`${PUBLIC}/store-1/product-1/artwork.jpg`)).toBe(false);
    // A file merely named "watermarked" is not one.
    expect(isWatermarkedProductImage(`${PUBLIC}/store-1/product-1/watermarked.jpg`)).toBe(false);
  });

  test("survives a url it cannot parse", () => {
    expect(isWatermarkedProductImage("not a url")).toBe(false);
  });

  test("names the folder and file the copy was made from", () => {
    expect(splitWatermarkedPath("store-1/product-1/watermarked/artwork.jpg")).toEqual({
      sourceDirectory: "store-1/product-1",
      base: "artwork",
    });
  });

  test("refuses a path that is not a watermarked copy", () => {
    expect(splitWatermarkedPath("store-1/product-1/artwork.jpg")).toBeNull();
    expect(splitWatermarkedPath("artwork.jpg")).toBeNull();
  });

  test("matches an original whose extension differs from the copy's", () => {
    // Copies are always JPEG; the source may have been a PNG.
    const split = splitWatermarkedPath("store-1/product-1/watermarked/artwork.jpg")!;
    expect(imageBaseName("artwork.png")).toBe(split.base);
  });

  test("keeps a name that has no extension", () => {
    expect(imageBaseName("artwork")).toBe("artwork");
    expect(imageBaseName(".hidden")).toBe(".hidden");
  });
});
