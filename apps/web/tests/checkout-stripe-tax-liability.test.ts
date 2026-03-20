import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const checkRateLimitMock = vi.fn();
const resolveStoreSlugFromRequestAsyncMock = vi.fn();
const resolveStorefrontSessionLinkMock = vi.fn();
const resolveStoreFeeProfileMock = vi.fn();
const calculatePlatformFeeCentsMock = vi.fn();
const writeOrderFeeBreakdownMock = vi.fn();
const sendOrderCreatedNotificationsMock = vi.fn();
const isStripeStubModeMock = vi.fn();
const getAppUrlMock = vi.fn();
const getStoreStripePaymentsReadinessMock = vi.fn();
const getStripeClientMock = vi.fn();
const adminFromMock = vi.fn();
const serverFromMock = vi.fn();
const stripeCheckoutCreateMock = vi.fn();

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args)
}));

vi.mock("@/lib/stores/active-store", () => ({
  resolveStoreSlugFromRequestAsync: (...args: unknown[]) => resolveStoreSlugFromRequestAsyncMock(...args)
}));

vi.mock("@/lib/analytics/session-linking", () => ({
  resolveStorefrontSessionLink: (...args: unknown[]) => resolveStorefrontSessionLinkMock(...args)
}));

vi.mock("@/lib/billing/fees", () => ({
  resolveStoreFeeProfile: (...args: unknown[]) => resolveStoreFeeProfileMock(...args),
  calculatePlatformFeeCents: (...args: unknown[]) => calculatePlatformFeeCentsMock(...args),
  writeOrderFeeBreakdown: (...args: unknown[]) => writeOrderFeeBreakdownMock(...args)
}));

vi.mock("@/lib/notifications/order-emails", () => ({
  sendOrderCreatedNotifications: (...args: unknown[]) => sendOrderCreatedNotificationsMock(...args)
}));

vi.mock("@/lib/env", () => ({
  getAppUrl: (...args: unknown[]) => getAppUrlMock(...args),
  isStripeStubMode: (...args: unknown[]) => isStripeStubModeMock(...args)
}));

vi.mock("@/lib/stripe/store-payments-readiness", () => ({
  getStoreStripePaymentsReadiness: (...args: unknown[]) => getStoreStripePaymentsReadinessMock(...args)
}));

vi.mock("@/lib/stripe/server", () => ({
  getStripeClient: (...args: unknown[]) => getStripeClientMock(...args)
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
    from: (...args: unknown[]) => serverFromMock(...args)
  }))
}));

function buildRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/orders/checkout?store=stripe-shop", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      host: "localhost:3000"
    },
    body: JSON.stringify(body)
  });
}

describe("checkout Stripe tax liability", () => {
  beforeEach(() => {
    vi.resetModules();

    enforceTrustedOriginMock.mockReset();
    checkRateLimitMock.mockReset();
    resolveStoreSlugFromRequestAsyncMock.mockReset();
    resolveStorefrontSessionLinkMock.mockReset();
    resolveStoreFeeProfileMock.mockReset();
    calculatePlatformFeeCentsMock.mockReset();
    writeOrderFeeBreakdownMock.mockReset();
    sendOrderCreatedNotificationsMock.mockReset();
    isStripeStubModeMock.mockReset();
    getAppUrlMock.mockReset();
    getStoreStripePaymentsReadinessMock.mockReset();
    getStripeClientMock.mockReset();
    adminFromMock.mockReset();
    serverFromMock.mockReset();
    stripeCheckoutCreateMock.mockReset();

    enforceTrustedOriginMock.mockReturnValue(null);
    checkRateLimitMock.mockResolvedValue(null);
    resolveStoreSlugFromRequestAsyncMock.mockResolvedValue("stripe-shop");
    resolveStorefrontSessionLinkMock.mockResolvedValue(null);
    resolveStoreFeeProfileMock.mockResolvedValue({
      planKey: "standard",
      feeBps: 500,
      feeFixedCents: 0
    });
    calculatePlatformFeeCentsMock.mockReturnValue(125);
    writeOrderFeeBreakdownMock.mockResolvedValue(undefined);
    sendOrderCreatedNotificationsMock.mockResolvedValue(undefined);
    isStripeStubModeMock.mockReturnValue(false);
    getAppUrlMock.mockReturnValue("https://www.myrivo.app");
    getStoreStripePaymentsReadinessMock.mockResolvedValue({
      connected: true,
      accountId: "acct_123",
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      taxSettingsStatus: "active",
      taxMissingFields: [],
      taxReady: true,
      readyForLiveCheckout: true
    });
    stripeCheckoutCreateMock.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/pay/cs_test_123"
    });
    getStripeClientMock.mockReturnValue({
      checkout: {
        sessions: {
          create: stripeCheckoutCreateMock
        }
      }
    });

    serverFromMock.mockReturnValue({
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
    });

    adminFromMock.mockImplementation((table: string) => {
      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: "store-1",
                  name: "Stripe Shop",
                  slug: "stripe-shop",
                  status: "live",
                  stripe_account_id: "acct_123"
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
                      price_cents: 2500,
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

      if (table === "storefront_checkout_sessions") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { id: "checkout-1" }, error: null }))
            }))
          })),
          update: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
  });

  test("creates Stripe Checkout with connected-account tax liability", async () => {
    const route = await import("@/app/api/orders/checkout/route");
    const response = await route.POST(
      buildRequest({
        firstName: "Alice",
        lastName: "Buyer",
        email: "alice@example.com",
        items: [{ variantId: "33333333-3333-4333-8333-333333333333", quantity: 1 }]
      })
    );
    const payload = (await response.json()) as { paymentMode: string; sessionId: string; checkoutUrl: string };

    expect(response.status).toBe(200);
    expect(payload.paymentMode).toBe("stripe");
    expect(payload.sessionId).toBe("cs_test_123");
    expect(getStoreStripePaymentsReadinessMock).toHaveBeenCalledWith("acct_123");
    expect(stripeCheckoutCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        automatic_tax: {
          enabled: true,
          liability: {
            type: "account",
            account: "acct_123"
          }
        },
        payment_intent_data: expect.objectContaining({
          transfer_data: {
            destination: "acct_123"
          },
          application_fee_amount: 125
        })
      })
    );
  });

  test("blocks checkout when Stripe tax setup is still pending", async () => {
    getStoreStripePaymentsReadinessMock.mockResolvedValue({
      connected: true,
      accountId: "acct_123",
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      taxSettingsStatus: "pending",
      taxMissingFields: ["head_office.address.country"],
      taxReady: false,
      readyForLiveCheckout: false
    });

    const route = await import("@/app/api/orders/checkout/route");
    const response = await route.POST(
      buildRequest({
        firstName: "Alice",
        lastName: "Buyer",
        email: "alice@example.com",
        items: [{ variantId: "33333333-3333-4333-8333-333333333333", quantity: 1 }]
      })
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(409);
    expect(payload.error).toBe("This store's Stripe tax setup is not complete yet.");
    expect(stripeCheckoutCreateMock).not.toHaveBeenCalled();
  });
});
