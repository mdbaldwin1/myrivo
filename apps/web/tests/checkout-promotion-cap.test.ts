import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { PROMOTION_CUSTOMER_CAP_REACHED_ERROR } from "@/lib/promotions/redemption";

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

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null } }))
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: null, error: null }))
              }))
            }))
          }))
        }))
      }))
    }))
  }))
}));

function buildRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/orders/checkout?store=cap-shop", {
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
  resolveStoreSlugFromRequestAsyncMock.mockResolvedValue("cap-shop");

  adminFromMock.mockImplementation((table: string) => {
    if (table === "stores") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: {
                id: "store-1",
                name: "Cap Shop",
                slug: "cap-shop",
                status: "live",
                stripe_account_id: null
              },
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
              data: {
                checkout_enable_local_pickup: false,
                checkout_local_pickup_label: "Local pickup",
                checkout_local_pickup_fee_cents: 0,
                checkout_enable_flat_rate_shipping: true,
                checkout_flat_rate_shipping_label: "Shipping",
                checkout_flat_rate_shipping_fee_cents: 0,
                checkout_allow_order_note: true
              },
              error: null
            }))
          }))
        }))
      };
    }

    if (table === "store_pickup_settings") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: {
                pickup_enabled: false,
                selection_mode: "buyer_select",
                geolocation_fallback_mode: "allow_without_distance",
                out_of_radius_behavior: "disable_pickup",
                eligibility_radius_miles: 10,
                lead_time_hours: 24,
                slot_interval_minutes: 60,
                show_pickup_times: false,
                timezone: "America/New_York"
              },
              error: null
            }))
          }))
        }))
      };
    }

    if (table === "pickup_locations") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              returns: vi.fn(async () => ({ data: [], error: null }))
            }))
          }))
        }))
      };
    }

    if (table === "product_variants") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(() => ({
              returns: vi.fn(async () => ({
                data: [
                  {
                    id: "33333333-3333-4333-8333-333333333333",
                    product_id: "11111111-1111-4111-8111-111111111111",
                    title: "Standard",
                    price_cents: 2400,
                    inventory_qty: 8,
                    is_made_to_order: false,
                    status: "active",
                    option_values: null,
                    products: {
                      id: "11111111-1111-4111-8111-111111111111",
                      title: "Starter Kit",
                      status: "active",
                      store_id: "store-1"
                    }
                  }
                ],
                error: null
              }))
            }))
          }))
        }))
      };
    }

    if (table === "promotions") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: "22222222-2222-4222-8222-222222222222",
                  code: "WELCOME10",
                  discount_type: "percent",
                  discount_value: 10,
                  min_subtotal_cents: 0,
                  max_redemptions: null,
                  per_customer_redemption_limit: 1,
                  times_redeemed: 0,
                  starts_at: null,
                  ends_at: null,
                  is_active: true
                },
                error: null
              }))
            }))
          }))
        }))
      };
    }

    if (table === "promotion_redemptions") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              returns: vi.fn(async () => ({
                data: [{ id: "redemption-1" }],
                error: null
              }))
            }))
          }))
        }))
      };
    }

    throw new Error(`Unexpected table ${table}`);
  });
});

describe("checkout promotion caps", () => {
  test("rejects promo codes once the customer redemption cap is reached", async () => {
    const route = await import("@/app/api/orders/checkout/route");
    const response = await route.POST(
      buildRequest({
        firstName: "Taylor",
        lastName: "Shopper",
        email: "taylor@example.com",
        fulfillmentMethod: "shipping",
        promoCode: "WELCOME10",
        items: [{ variantId: "33333333-3333-4333-8333-333333333333", quantity: 1 }]
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: PROMOTION_CUSTOMER_CAP_REACHED_ERROR
    });
  });
});
