import { describe, expect, test } from "vitest";
import {
  productInvolvesDigital,
  requiresShipping,
  resolveVariantFulfillment,
} from "@/lib/digital-products/fulfillment";
import { resolveCheckoutComposition } from "@/lib/storefront/checkout-composition";
import { normalizeStorefrontCart } from "@/lib/storefront/cart";

describe("fulfillment on the thing a buyer actually buys", () => {
  test("a variant overrides the product it belongs to", () => {
    // One painting, three ways to own it.
    expect(resolveVariantFulfillment("physical", "digital")).toBe("digital");
    expect(resolveVariantFulfillment("digital", "physical")).toBe("physical");
  });

  test("a variant with no opinion inherits the product's", () => {
    expect(resolveVariantFulfillment("digital", null)).toBe("digital");
    expect(resolveVariantFulfillment("physical", undefined)).toBe("physical");
    expect(resolveVariantFulfillment(null, null)).toBe("physical");
  });

  test("a product involves digital delivery when any variant does", () => {
    expect(
      productInvolvesDigital({
        productType: "physical",
        variants: [{ fulfillmentType: null }, { fulfillmentType: "digital" }],
      }),
    ).toBe(true);

    // And stops involving it once every variant has opted out.
    expect(
      productInvolvesDigital({
        productType: "digital",
        variants: [{ fulfillmentType: "physical" }, { fulfillmentType: "physical" }],
      }),
    ).toBe(false);
  });

  test("shipping is needed for the physical part of a mixed order", () => {
    expect(requiresShipping([{ fulfillmentType: "digital" }])).toBe(false);
    expect(requiresShipping([{ fulfillmentType: "digital" }, { fulfillmentType: "physical" }])).toBe(true);
  });

  test("a painting sold three ways is one mixed order, not three", () => {
    expect(
      resolveCheckoutComposition([
        { productType: "digital" },
        { productType: "physical" },
        { productType: "physical" },
      ]),
    ).toBe("mixed");
  });

  test("quantity is clamped for the download variant and not its print", () => {
    const product = {
      id: "product-1",
      product_type: "physical" as const,
      product_variants: [
        { id: "download", status: "active" as const, fulfillment_type: "digital" as const },
        { id: "print", status: "active" as const, fulfillment_type: null },
      ],
    };

    const normalized = normalizeStorefrontCart(
      [
        { productId: "product-1", variantId: "download", quantity: 4 },
        { productId: "product-1", variantId: "print", quantity: 3 },
      ],
      [product],
    );

    expect(normalized).toEqual([
      { productId: "product-1", variantId: "download", quantity: 1 },
      { productId: "product-1", variantId: "print", quantity: 3 },
    ]);
  });
});
