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

function buildRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/promotions/preview?store=sister-shop", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      host: "localhost:3000"
    },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  vi.resetModules();
  enforceTrustedOriginMock.mockReset();
  checkRateLimitMock.mockReset();
  resolveStoreSlugFromRequestAsyncMock.mockReset();
  adminFromMock.mockReset();

  enforceTrustedOriginMock.mockReturnValue(null);
  checkRateLimitMock.mockResolvedValue(null);
  resolveStoreSlugFromRequestAsyncMock.mockResolvedValue("sister-shop");
});

describe("promotions preview route", () => {
  test("allows a stackable promo preview for a live store", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: "store-1", status: "live" },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "store_settings") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { checkout_max_promo_codes: 2 },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "promotions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [
                  {
                    id: "promo-1",
                    code: "WELCOME10",
                    discount_type: "percent",
                    discount_value: 10,
                    min_subtotal_cents: 0,
                    max_redemptions: null,
                    per_customer_redemption_limit: null,
                    times_redeemed: 0,
                    starts_at: null,
                    ends_at: null,
                    is_active: true,
                    is_stackable: true
                  }
                ],
                error: null
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/promotions/preview/route");
    const response = await route.POST(
      buildRequest({
        promoCode: "WELCOME10",
        subtotalCents: 2000
      })
    );
    const payload = (await response.json()) as { promoCode: string; promoCodes: string[]; discountCents: number };

    expect(response.status).toBe(200);
    expect(payload.promoCode).toBe("WELCOME10");
    expect(payload.promoCodes).toEqual(["WELCOME10"]);
    expect(payload.discountCents).toBe(200);
  });

  test("returns a shipping adjustment for free shipping promotions", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: "store-1", status: "live" },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "store_settings") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { checkout_max_promo_codes: 2 },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "promotions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [
                  {
                    id: "promo-ship",
                    code: "FREESHIP",
                    discount_type: "free_shipping",
                    discount_value: 0,
                    min_subtotal_cents: 0,
                    max_redemptions: null,
                    per_customer_redemption_limit: null,
                    times_redeemed: 0,
                    starts_at: null,
                    ends_at: null,
                    is_active: true,
                    is_stackable: true
                  }
                ],
                error: null
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/promotions/preview/route");
    const response = await route.POST(
      buildRequest({
        promoCode: "FREESHIP",
        subtotalCents: 2000,
        shippingFeeCents: 799,
        fulfillmentMethod: "shipping"
      })
    );
    const payload = (await response.json()) as {
      promoCode: string;
      discountCents: number;
      shippingDiscountCents: number;
      effectiveShippingFeeCents: number;
      discountedTotalCents: number;
    };

    expect(response.status).toBe(200);
    expect(payload.promoCode).toBe("FREESHIP");
    expect(payload.discountCents).toBe(0);
    expect(payload.shippingDiscountCents).toBe(799);
    expect(payload.effectiveShippingFeeCents).toBe(0);
    expect(payload.discountedTotalCents).toBe(2000);
  });

  test("enforces the store max promo code limit", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: "store-1", status: "live" },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "store_settings") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { checkout_max_promo_codes: 1 },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "promotions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [
                  {
                    id: "promo-1",
                    code: "WELCOME10",
                    discount_type: "percent",
                    discount_value: 10,
                    min_subtotal_cents: 0,
                    max_redemptions: null,
                    per_customer_redemption_limit: null,
                    times_redeemed: 0,
                    starts_at: null,
                    ends_at: null,
                    is_active: true,
                    is_stackable: true
                  },
                  {
                    id: "promo-2",
                    code: "VIP5",
                    discount_type: "fixed",
                    discount_value: 500,
                    min_subtotal_cents: 0,
                    max_redemptions: null,
                    per_customer_redemption_limit: null,
                    times_redeemed: 0,
                    starts_at: null,
                    ends_at: null,
                    is_active: true,
                    is_stackable: true
                  }
                ],
                error: null
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/promotions/preview/route");
    const response = await route.POST(
      buildRequest({
        promoCode: "VIP5",
        promoCodes: ["WELCOME10", "VIP5"],
        subtotalCents: 5000
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Only 1 promo code can be applied to one order."
    });
  });
});
