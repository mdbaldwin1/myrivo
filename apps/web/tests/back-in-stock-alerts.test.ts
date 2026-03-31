import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const checkRateLimitMock = vi.fn();
const resolveStoreSlugFromRequestAsyncMock = vi.fn();
const adminFromMock = vi.fn();

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args)
}));

vi.mock("@/lib/stores/active-store", () => ({
  resolveStoreSlugFromRequestAsync: (...args: unknown[]) => resolveStoreSlugFromRequestAsyncMock(...args)
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

describe("back in stock helpers", () => {
  test("findRestockedVariantIds only returns variants that crossed from empty to available", async () => {
    const { findRestockedVariantIds } = await import("@/lib/back-in-stock/alerts");

    expect(
      findRestockedVariantIds(
        [
          { id: "variant-1", inventory_qty: 0, status: "active" },
          { id: "variant-2", inventory_qty: 2, status: "active" },
          { id: "variant-3", inventory_qty: 0, status: "archived" }
        ],
        [
          { id: "variant-1", inventory_qty: 5, status: "active" },
          { id: "variant-2", inventory_qty: 3, status: "active" },
          { id: "variant-3", inventory_qty: 5, status: "archived" }
        ]
      )
    ).toEqual(["variant-1"]);
  });
});

describe("storefront back in stock alerts route", () => {
  beforeEach(() => {
    vi.resetModules();
    enforceTrustedOriginMock.mockReset();
    checkRateLimitMock.mockReset();
    resolveStoreSlugFromRequestAsyncMock.mockReset();
    adminFromMock.mockReset();

    enforceTrustedOriginMock.mockReturnValue(null);
    checkRateLimitMock.mockResolvedValue(null);
    resolveStoreSlugFromRequestAsyncMock.mockResolvedValue("at-home-apothecary");

    adminFromMock.mockImplementation((table: string) => {
      if (table === "stores") {
        const chain = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          maybeSingle: vi.fn(async () => ({
            data: { id: "store-1", name: "At Home Apothecary", slug: "at-home-apothecary", status: "live" },
            error: null
          }))
        };
        return chain;
      }

      if (table === "product_variants") {
        const chain = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          maybeSingle: vi.fn(async () => ({
            data: {
              id: "11111111-1111-4111-8111-111111111111",
              product_id: "22222222-2222-4222-8222-222222222222",
              inventory_qty: 0,
              is_made_to_order: false,
              status: "active"
            },
            error: null
          }))
        };
        return chain;
      }

      if (table === "back_in_stock_alerts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  ilike: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: null, error: null }))
                  }))
                }))
              }))
            }))
          })),
          insert: vi.fn(async () => ({ error: null }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
  });

  test("stores a pending back-in-stock request for an unavailable variant", async () => {
    const { POST } = await import("@/app/api/storefront/back-in-stock-alerts/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/storefront/back-in-stock-alerts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          email: "shopper@example.com",
          storeSlug: "at-home-apothecary",
          productId: "22222222-2222-4222-8222-222222222222",
          variantId: "11111111-1111-4111-8111-111111111111",
          location: "/s/at-home-apothecary/products/22222222-2222-4222-8222-222222222222"
        })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });
});
