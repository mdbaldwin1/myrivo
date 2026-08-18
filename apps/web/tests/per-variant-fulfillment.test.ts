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

describe("which products the digital rules apply to", () => {
  test("a storefront summary follows the variants, not the product", async () => {
    const { enrichStorefrontDigitalProducts } = await import("@/lib/digital-products/storefront-summary");
    const calls: string[][] = [];
    // The builder chains .eq() twice before .in(), so the stub keeps returning
    // itself until asked for rows.
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.in = (_column: string, ids: string[]) => {
      calls.push(ids);
      return chain;
    };
    chain.order = () => chain;
    chain.returns = async () => ({ data: [], error: null });
    const admin = {
      from: () => chain,
      storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: null } }) }) },
    } as never;

    const painting = {
      id: "painting",
      product_type: "physical" as const,
      product_variants: [{ fulfillment_type: "digital" as const }, { fulfillment_type: null }],
    };
    const mug = { id: "mug", product_type: "physical" as const, product_variants: [{ fulfillment_type: null }] };

    const enriched = await enrichStorefrontDigitalProducts({
      admin,
      storeId: "store-1",
      products: [painting, mug],
    });

    // The painting sells a download, so it gets a summary; the mug does not.
    expect(enriched.find((p) => p.id === "painting")?.digital_summary).not.toBeNull();
    expect(enriched.find((p) => p.id === "mug")?.digital_summary).toBeNull();
    expect(calls[0]).toEqual(["painting"]);
  });

  test("a digital product whose variants all ship needs no summary", async () => {
    const { enrichStorefrontDigitalProducts } = await import("@/lib/digital-products/storefront-summary");
    const admin = { from: () => { throw new Error("should not query"); } } as never;

    const enriched = await enrichStorefrontDigitalProducts({
      admin,
      storeId: "store-1",
      products: [
        {
          id: "prints-only",
          product_type: "digital" as const,
          product_variants: [{ fulfillment_type: "physical" as const }],
        },
      ],
    });

    expect(enriched[0]?.digital_summary).toBeNull();
  });
});
