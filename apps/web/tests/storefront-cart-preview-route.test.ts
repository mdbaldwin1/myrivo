import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const adminFromMock = vi.fn();
const resolveStoreSlugFromRequestAsyncMock = vi.fn();
const resolveStoreDigitalProductsAccessMock = vi.fn();

vi.mock("@/lib/digital-products/feature-gating", () => ({
  resolveStoreDigitalProductsAccess: (...args: unknown[]) => resolveStoreDigitalProductsAccessMock(...args)
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: (...args: unknown[]) => adminFromMock(...args) })
}));

vi.mock("@/lib/stores/active-store", () => ({
  resolveStoreSlugFromRequestAsync: (...args: unknown[]) => resolveStoreSlugFromRequestAsyncMock(...args)
}));

const ids = {
  digitalProduct: "11111111-1111-4111-8111-111111111111",
  digitalVariant: "22222222-2222-4222-8222-222222222222",
  physicalProduct: "33333333-3333-4333-8333-333333333333",
  physicalVariant: "44444444-4444-4444-8444-444444444444",
  inactiveProduct: "55555555-5555-4555-8555-555555555555",
  inactiveVariant: "66666666-6666-4666-8666-666666666666"
} as const;

function collectionQuery(data: unknown[]) {
  const query = {
    eq: vi.fn(() => query),
    in: vi.fn(async () => ({ data, error: null }))
  };
  return query;
}

beforeEach(() => {
  vi.resetModules();
  adminFromMock.mockReset();
  resolveStoreSlugFromRequestAsyncMock.mockReset();
  resolveStoreSlugFromRequestAsyncMock.mockResolvedValue("curby");
  resolveStoreDigitalProductsAccessMock.mockReset().mockResolvedValue({ enabled: true, planEligible: true, storeEnabled: true, planKey: "test" });
});

describe("storefront cart preview route", () => {
  test("uses active catalog relationships to discard invalid entries and normalize quantities", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: { id: "store-1", status: "live" }, error: null }))
            }))
          }))
        };
      }
      if (table === "product_variants") {
        return {
          select: vi.fn(() => collectionQuery([
            {
              id: ids.digitalVariant,
              product_id: ids.digitalProduct,
              status: "active",
              price_cents: 1200,
              option_values: {},
              title: "Download"
            },
            {
              id: ids.physicalVariant,
              product_id: ids.physicalProduct,
              status: "active",
              price_cents: 500,
              option_values: { Size: "Small" },
              title: null
            },
            {
              id: ids.inactiveVariant,
              product_id: ids.inactiveProduct,
              status: "archived",
              price_cents: 9999,
              option_values: {},
              title: null
            }
          ]))
        };
      }
      if (table === "products") {
        return {
          select: vi.fn(() => collectionQuery([
            { id: ids.digitalProduct, title: "Printable", status: "active", product_type: "digital" },
            { id: ids.physicalProduct, title: "Frame", status: "active", product_type: "physical" },
            { id: ids.inactiveProduct, title: "Old", status: "archived", product_type: "physical" }
          ]))
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/storefront/cart-preview/route");
    const request = new NextRequest("http://localhost:3000/api/storefront/cart-preview?store=curby", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entries: [
          { productId: ids.digitalProduct, variantId: ids.digitalVariant, quantity: 7 },
          { productId: ids.digitalProduct, variantId: ids.digitalVariant, quantity: 4 },
          { productId: ids.physicalProduct, variantId: ids.physicalVariant, quantity: 70 },
          { productId: ids.physicalProduct, variantId: ids.physicalVariant, quantity: 40 },
          { productId: ids.inactiveProduct, variantId: ids.inactiveVariant, quantity: 1 },
          { productId: ids.digitalProduct, variantId: ids.physicalVariant, quantity: 1 }
        ]
      })
    });

    const inactivePlanRequest = new NextRequest(request.clone());
    const response = await route.POST(request);
    const payload = await response.json();

    expect(payload).toEqual({
      items: [
        {
          key: `${ids.digitalProduct}:${ids.digitalVariant}`,
          productId: ids.digitalProduct,
          variantId: ids.digitalVariant,
          productTitle: "Printable",
          variantLabel: "Download",
          productType: "digital",
          quantity: 1,
          unitPriceCents: 1200,
          lineTotalCents: 1200
        },
        {
          key: `${ids.physicalProduct}:${ids.physicalVariant}`,
          productId: ids.physicalProduct,
          variantId: ids.physicalVariant,
          productTitle: "Frame",
          variantLabel: "Small",
          productType: "physical",
          quantity: 99,
          unitPriceCents: 500,
          lineTotalCents: 49500
        }
      ],
      subtotalCents: 50700
    });

    resolveStoreDigitalProductsAccessMock.mockResolvedValue({
      enabled: false,
      planEligible: false,
      storeEnabled: true,
      planKey: "standard"
    });
    const inactivePlanResponse = await route.POST(inactivePlanRequest);
    await expect(inactivePlanResponse.json()).resolves.toEqual({
      items: [{
        key: `${ids.physicalProduct}:${ids.physicalVariant}`,
        productId: ids.physicalProduct,
        variantId: ids.physicalVariant,
        productTitle: "Frame",
        variantLabel: "Small",
        productType: "physical",
        quantity: 99,
        unitPriceCents: 500,
        lineTotalCents: 49500
      }],
      subtotalCents: 49500
    });
  });
});
