import { describe, expect, test } from "vitest";
import { normalizeStorefrontCart } from "@/lib/storefront/cart";

describe("normalizeStorefrontCart", () => {
  test("collapses digital duplicates to one while aggregating physical lines", () => {
    expect(normalizeStorefrontCart([
      { productId: "digital", variantId: "download", quantity: 4 },
      { productId: "digital", variantId: "download", quantity: 1 },
      { productId: "physical", variantId: "oak", quantity: 2 },
      { productId: "physical", variantId: "oak", quantity: 3 }
    ], [
      { id: "digital", product_type: "digital" },
      { id: "physical", product_type: "physical" }
    ])).toEqual([
      { productId: "digital", variantId: "download", quantity: 1 },
      { productId: "physical", variantId: "oak", quantity: 5 }
    ]);
  });

  test("drops malformed runtime quantities instead of persisting NaN", () => {
    expect(normalizeStorefrontCart([
      { productId: "digital", variantId: "download", quantity: Number.NaN },
      { productId: "physical", variantId: "oak", quantity: Number.POSITIVE_INFINITY }
    ], [
      { id: "digital", product_type: "digital" },
      { id: "physical", product_type: "physical" }
    ])).toEqual([]);
  });
});
