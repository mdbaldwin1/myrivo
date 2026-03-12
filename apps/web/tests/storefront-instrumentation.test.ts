import { describe, expect, test } from "vitest";
import {
  buildStorefrontAddToCartValue,
  buildStorefrontCartAnalyticsValue,
  buildStorefrontSearchSignature,
  markStorefrontCheckoutCompletedTracked,
  normalizeStorefrontSearchQuery
} from "@/lib/analytics/storefront-instrumentation";

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    }
  };
}

describe("storefront analytics instrumentation helpers", () => {
  test("normalizes shopper search queries", () => {
    expect(normalizeStorefrontSearchQuery("  Body   Oil  ")).toBe("body oil");
  });

  test("builds a stable search signature", () => {
    const signature = buildStorefrontSearchSignature({
      query: "Body Oil",
      resultCount: 3,
      sortMode: "featured",
      availabilityFilter: "all",
      selectedFilterValuesByAxis: { Size: ["Large", "Small"] },
      view: "products"
    });

    expect(signature).toContain("\"query\":\"body oil\"");
    expect(signature).toContain("\"resultCount\":3");
    expect(signature).toContain("\"Size\":[\"Large\",\"Small\"]");
  });

  test("builds cart analytics summaries", () => {
    expect(
      buildStorefrontCartAnalyticsValue({
        items: [
          { productId: "product-1", variantId: "variant-1", quantity: 2, unitPriceCents: 1200 },
          { productId: "product-2", variantId: "variant-2", quantity: 1, unitPriceCents: 800 }
        ],
        fulfillmentMethod: "shipping",
        discountCents: 300,
        shippingCents: 500
      })
    ).toEqual({
      discountCents: 300,
      fulfillmentMethod: "shipping",
      itemCount: 3,
      productIds: ["product-1", "product-2"],
      shippingCents: 500,
      subtotalCents: 3200,
      totalCents: 3400
    });
  });

  test("builds add-to-cart payloads", () => {
    expect(
      buildStorefrontAddToCartValue({
        variantId: "variant-1",
        quantity: 2,
        unitPriceCents: 1800,
        source: "product_detail"
      })
    ).toEqual({
      quantity: 2,
      source: "product_detail",
      unitPriceCents: 1800,
      variantId: "variant-1"
    });
  });

  test("dedupes checkout completion tracking per order id", () => {
    const storage = createMemoryStorage();
    expect(markStorefrontCheckoutCompletedTracked("order-1", storage)).toBe(true);
    expect(markStorefrontCheckoutCompletedTracked("order-1", storage)).toBe(false);
    expect(markStorefrontCheckoutCompletedTracked("order-2", storage)).toBe(true);
  });
});
