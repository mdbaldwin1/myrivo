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
      { id: "digital", product_type: "digital", product_variants: [{ id: "download", status: "active" }] },
      { id: "physical", product_type: "physical", product_variants: [{ id: "oak", status: "active" }] }
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
      { id: "digital", product_type: "digital", product_variants: [{ id: "download", status: "active" }] },
      { id: "physical", product_type: "physical", product_variants: [{ id: "oak", status: "active" }] }
    ])).toEqual([]);
  });

  test("removes stale, archived, and cross-product variant selections", () => {
    expect(normalizeStorefrontCart([
      { productId: "digital", variantId: "active-download", quantity: 1 },
      { productId: "digital", variantId: "archived-download", quantity: 1 },
      { productId: "digital", variantId: "missing-download", quantity: 1 },
      { productId: "digital", variantId: "other-jar", quantity: 1 }
    ], [
      {
        id: "digital",
        product_type: "digital",
        product_variants: [
          { id: "active-download", status: "active" },
          { id: "archived-download", status: "archived" }
        ]
      },
      {
        id: "physical",
        product_type: "physical",
        product_variants: [{ id: "other-jar", status: "active" }]
      }
    ])).toEqual([
      { productId: "digital", variantId: "active-download", quantity: 1 }
    ]);
  });
});
