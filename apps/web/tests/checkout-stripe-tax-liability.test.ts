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
const adminRpcMock = vi.fn();
const serverFromMock = vi.fn();
const stripeCheckoutCreateMock = vi.fn();
const createOrReuseCheckoutManifestMock = vi.fn();
const issueDigitalEntitlementsMock = vi.fn();
const checkoutSessionUpdatePayloads: Array<Record<string, unknown>> = [];
let checkoutProductType: "physical" | "digital";
let checkoutStoreId: string;
let pendingCheckoutId: string;
let authenticatedUserId: string | null;

class TestDigitalPurchaseManifestError extends Error {}

vi.mock("@/lib/digital-products/manifest-service", () => ({
  createOrReuseCheckoutManifest: (...args: unknown[]) =>
    createOrReuseCheckoutManifestMock(...args),
  buildDigitalManifestStripeMetadata: (manifestId: string) => ({
    digital_manifest_id: manifestId
  }),
  DigitalPurchaseManifestError: TestDigitalPurchaseManifestError
}));

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

vi.mock("@/lib/digital-products/entitlements", () => ({
  issueDigitalEntitlements: (...args: unknown[]) => issueDigitalEntitlementsMock(...args)
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
    from: (...args: unknown[]) => adminFromMock(...args),
    rpc: (...args: unknown[]) => adminRpcMock(...args)
  }))
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: authenticatedUserId ? { id: authenticatedUserId } : null }
      }))
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
    adminRpcMock.mockReset();
    serverFromMock.mockReset();
    stripeCheckoutCreateMock.mockReset();
    createOrReuseCheckoutManifestMock.mockReset();
    issueDigitalEntitlementsMock.mockReset();
    checkoutSessionUpdatePayloads.length = 0;
    checkoutProductType = "physical";
    checkoutStoreId = "store-1";
    pendingCheckoutId = "checkout-1";
    authenticatedUserId = null;

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
    issueDigitalEntitlementsMock.mockResolvedValue(null);
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
    adminRpcMock.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === "get_storefront_checkout_attempt") {
        return { data: null, error: null };
      }
      if (name === "create_or_reuse_storefront_checkout_attempt") {
        return {
          data: {
            ...(args.p_checkout as Record<string, unknown>),
            id: pendingCheckoutId,
            order_id: null,
            digital_manifest_id: null,
            stripe_checkout_session_id: null,
            stripe_checkout_url: null,
            checkout_attempt_key: args.p_checkout_attempt_key,
            checkout_request_fingerprint_sha256: args.p_request_fingerprint_sha256,
            created: true
          },
          error: null
        };
      }
      if (name === "bind_storefront_checkout_stripe_session") {
        return {
          data: {
            id: pendingCheckoutId,
            status: "pending",
            stripe_checkout_session_id: args.p_stripe_checkout_session_id,
            stripe_checkout_url: args.p_stripe_checkout_url
          },
          error: null
        };
      }
      throw new Error(`Unexpected RPC ${name}`);
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
                  id: checkoutStoreId,
                  name: "Stripe Shop",
                  slug: "stripe-shop",
                  status: "live",
                  stripe_account_id: "acct_123",
                  tax_collection_mode: "stripe_tax"
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
                        store_id: checkoutStoreId,
                        product_type: checkoutProductType
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
              single: vi.fn(async () => ({ data: { id: pendingCheckoutId }, error: null }))
            }))
          })),
          update: vi.fn((values: Record<string, unknown>) => {
            checkoutSessionUpdatePayloads.push(values);
            return {
              eq: vi.fn(async () => ({ error: null }))
            };
          })
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
        phone: "555-0100",
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
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              product_data: expect.objectContaining({
                name: "Starter Kit"
              }),
              unit_amount: 2500
            }),
            quantity: 1
          })
        ],
        shipping_options: [
          expect.objectContaining({
            shipping_rate_data: expect.objectContaining({
              display_name: "Shipping",
              fixed_amount: expect.objectContaining({
                amount: 0,
                currency: "usd"
              })
            })
          })
        ],
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
      }),
      { idempotencyKey: "storefront-checkout:checkout-1" }
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
        phone: "555-0100",
        email: "alice@example.com",
        items: [{ variantId: "33333333-3333-4333-8333-333333333333", quantity: 1 }]
      })
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(409);
    expect(payload.error).toBe("This store's Stripe tax setup is not complete yet.");
    expect(stripeCheckoutCreateMock).not.toHaveBeenCalled();
  });

  test("snapshots digital files before Stripe and sends only the opaque manifest id", async () => {
    checkoutProductType = "digital";
    checkoutStoreId = "10000000-0000-4000-8000-000000000001";
    pendingCheckoutId = "40000000-0000-4000-8000-000000000001";
    createOrReuseCheckoutManifestMock.mockResolvedValue({
      manifestId: "b0000000-0000-4000-8000-000000000001",
      items: [
        {
          customerFilename: "private-original.zip",
          assetVersionId: "70000000-0000-4000-8000-000000000001"
        }
      ]
    });

    const route = await import("@/app/api/orders/checkout/route");
    const response = await route.POST(
      buildRequest({
        firstName: "Alice",
        lastName: "Buyer",
        phone: "",
        email: "alice@example.com",
        digitalDeliveryConsent: true,
        items: [
          {
            variantId: "33333333-3333-4333-8333-333333333333",
            quantity: 1
          }
        ]
      })
    );

    expect(response.status).toBe(200);
    expect(createOrReuseCheckoutManifestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        checkoutSessionId: pendingCheckoutId,
        storeId: checkoutStoreId,
        items: [
          expect.objectContaining({
            productId: "11111111-1111-4111-8111-111111111111",
            variantId: "33333333-3333-4333-8333-333333333333",
            quantity: 1
          })
        ]
      })
    );
    expect(
      createOrReuseCheckoutManifestMock.mock.invocationCallOrder[0]
    ).toBeLessThan(stripeCheckoutCreateMock.mock.invocationCallOrder[0]!);

    const [stripeRequest, stripeOptions] = stripeCheckoutCreateMock.mock.calls[0]!;
    expect(stripeOptions).toEqual({
      idempotencyKey: `storefront-checkout:${pendingCheckoutId}`
    });
    expect(stripeRequest.metadata).toEqual(
      expect.objectContaining({
        digital_manifest_id: "b0000000-0000-4000-8000-000000000001"
      })
    );
    expect(stripeRequest.payment_intent_data.metadata).toEqual(
      expect.objectContaining({
        digital_manifest_id: "b0000000-0000-4000-8000-000000000001"
      })
    );
    expect(JSON.stringify(stripeRequest.metadata)).not.toContain(
      "private-original.zip"
    );
    expect(JSON.stringify(stripeRequest.metadata)).not.toContain("assetVersionId");
    expect(stripeRequest).not.toHaveProperty("shipping_options");
  });

  test("allows checkout for seller-attested no-tax stores when Stripe is operationally ready", async () => {
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
                  stripe_account_id: "acct_123",
                  tax_collection_mode: "seller_attested_no_tax"
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

    const route = await import("@/app/api/orders/checkout/route");
    const response = await route.POST(
      buildRequest({
        firstName: "Alice",
        lastName: "Buyer",
        phone: "555-0100",
        email: "alice@example.com",
        items: [{ variantId: "33333333-3333-4333-8333-333333333333", quantity: 1 }]
      })
    );
    const payload = (await response.json()) as { paymentMode: string; sessionId: string };

    expect(response.status).toBe(200);
    expect(payload.paymentMode).toBe("stripe");
    expect(payload.sessionId).toBe("cs_test_123");
    expect(stripeCheckoutCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              product_data: expect.objectContaining({
                name: "Starter Kit"
              }),
              unit_amount: 2500
            }),
            quantity: 1
          })
        ],
        shipping_options: [
          expect.objectContaining({
            shipping_rate_data: expect.objectContaining({
              display_name: "Shipping"
            })
          })
        ]
      }),
      { idempotencyKey: "storefront-checkout:checkout-1" }
    );
    expect(stripeCheckoutCreateMock.mock.calls[0]?.[0]).not.toHaveProperty("automatic_tax");
  });

  test("recovers when Stripe accepted the session but persisting its binding failed", async () => {
    checkoutProductType = "digital";
    checkoutStoreId = "10000000-0000-4000-8000-000000000001";
    pendingCheckoutId = "40000000-0000-4000-8000-000000000001";
    createOrReuseCheckoutManifestMock.mockResolvedValue({
      manifestId: "b0000000-0000-4000-8000-000000000001",
      items: []
    });
    let createAttemptCalls = 0;
    let bindCalls = 0;
    let persistedCheckout: Record<string, unknown> | null = null;
    adminRpcMock.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === "get_storefront_checkout_attempt") {
        return { data: persistedCheckout, error: null };
      }
      if (name === "create_or_reuse_storefront_checkout_attempt") {
        createAttemptCalls += 1;
        persistedCheckout = {
          ...(args.p_checkout as Record<string, unknown>),
          id: pendingCheckoutId,
          order_id: null,
          digital_manifest_id: "b0000000-0000-4000-8000-000000000001",
          stripe_checkout_session_id: null,
          stripe_checkout_url: null,
          created: createAttemptCalls === 1
        };
        return {
          data: {
            ...(args.p_checkout as Record<string, unknown>),
            id: pendingCheckoutId,
            order_id: null,
            digital_manifest_id: createAttemptCalls === 1 ? null : "b0000000-0000-4000-8000-000000000001",
            stripe_checkout_session_id: null,
            stripe_checkout_url: null,
            created: createAttemptCalls === 1
          },
          error: null
        };
      }
      if (name === "bind_storefront_checkout_stripe_session") {
        bindCalls += 1;
        return bindCalls === 1
          ? { data: null, error: { message: "Injected checkout binding write failure" } }
          : { data: { id: pendingCheckoutId }, error: null };
      }
      throw new Error(`Unexpected RPC ${name}`);
    });
    const requestBody = {
      checkoutAttemptId: "018f6fc1-8adc-7f43-8000-000000000001",
      firstName: "Alice",
      lastName: "Buyer",
      phone: "",
      email: "alice@example.com",
      digitalDeliveryConsent: true,
      items: [{ variantId: "33333333-3333-4333-8333-333333333333", quantity: 1 }]
    };
    const route = await import("@/app/api/orders/checkout/route");

    const first = await route.POST(buildRequest(requestBody));
    const second = await route.POST(buildRequest(requestBody));

    expect(first.status).toBe(503);
    expect(second.status).toBe(200);
    expect(stripeCheckoutCreateMock).toHaveBeenCalledTimes(2);
    expect(stripeCheckoutCreateMock.mock.calls.map((call) => call[1])).toEqual([
      { idempotencyKey: `storefront-checkout:${pendingCheckoutId}` },
      { idempotencyKey: `storefront-checkout:${pendingCheckoutId}` }
    ]);
    expect(checkoutSessionUpdatePayloads).not.toContainEqual(expect.objectContaining({ status: "failed" }));
  });

  test("keeps an ambiguous Stripe timeout pending and safely resumes the same attempt", async () => {
    stripeCheckoutCreateMock
      .mockRejectedValueOnce(new Error("Stripe request timed out after write"))
      .mockResolvedValueOnce({
        id: "cs_test_123",
        url: "https://checkout.stripe.com/pay/cs_test_123"
      });
    const requestBody = {
      checkoutAttemptId: "018f6fc1-8adc-7f43-8000-000000000002",
      firstName: "Alice",
      lastName: "Buyer",
      phone: "555-0100",
      email: "alice@example.com",
      items: [{ variantId: "33333333-3333-4333-8333-333333333333", quantity: 1 }]
    };
    const route = await import("@/app/api/orders/checkout/route");

    const first = await route.POST(buildRequest(requestBody));
    const second = await route.POST(buildRequest(requestBody));

    expect(first.status).toBe(503);
    expect(second.status).toBe(200);
    expect(stripeCheckoutCreateMock).toHaveBeenCalledTimes(2);
    expect(stripeCheckoutCreateMock.mock.calls.map((call) => call[1])).toEqual([
      { idempotencyKey: `storefront-checkout:${pendingCheckoutId}` },
      { idempotencyKey: `storefront-checkout:${pendingCheckoutId}` }
    ]);
    expect(checkoutSessionUpdatePayloads).not.toContainEqual(expect.objectContaining({ status: "failed" }));
  });

  test("binds a Stripe session id even when Stripe returns no redirect URL", async () => {
    stripeCheckoutCreateMock.mockResolvedValue({
      id: "cs_test_no_redirect_yet",
      url: null
    });
    const route = await import("@/app/api/orders/checkout/route");
    const response = await route.POST(
      buildRequest({
        checkoutAttemptId: "018f6fc1-8adc-7f43-8000-000000000006",
        firstName: "Alice",
        lastName: "Buyer",
        phone: "555-0100",
        email: "alice@example.com",
        items: [{ variantId: "33333333-3333-4333-8333-333333333333", quantity: 1 }]
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("try again")
    });
    expect(adminRpcMock).toHaveBeenCalledWith(
      "bind_storefront_checkout_stripe_session",
      {
        p_checkout_session_id: pendingCheckoutId,
        p_store_id: checkoutStoreId,
        p_stripe_checkout_session_id: "cs_test_no_redirect_yet",
        p_stripe_checkout_url: null
      }
    );
  });

  test("reuses a legacy authenticated checkout after its source cart becomes ordered", async () => {
    authenticatedUserId = "20000000-0000-4000-8000-000000000001";
    isStripeStubModeMock.mockReturnValue(true);
    const cartId = "30000000-0000-4000-8000-000000000001";
    const orderId = "50000000-0000-4000-8000-000000000001";
    let cartStatus: "active" | "ordered" = "active";
    serverFromMock.mockImplementation(() => ({
      select: vi.fn(() => {
        let requestedStatus: string | null = null;
        const query = {
          eq: vi.fn((column: string, value: string) => {
            if (column === "status") requestedStatus = value;
            return query;
          }),
          order: vi.fn(() => query),
          limit: vi.fn(() => query),
          maybeSingle: vi.fn(async () => ({
            data: requestedStatus === cartStatus ? { id: cartId } : null,
            error: null
          }))
        };
        return query;
      })
    }));

    const attempts = new Map<string, Record<string, unknown>>();
    let checkoutCreates = 0;
    let orderEffects = 0;
    adminRpcMock.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      const attemptKey = String(args.p_checkout_attempt_key ?? "");
      if (name === "get_storefront_checkout_attempt") {
        return { data: attempts.get(attemptKey) ?? null, error: null };
      }
      if (name === "create_or_reuse_storefront_checkout_attempt") {
        checkoutCreates += 1;
        const checkout = {
          ...(args.p_checkout as Record<string, unknown>),
          id: `40000000-0000-4000-8000-${String(checkoutCreates).padStart(12, "0")}`,
          status: "pending",
          order_id: null,
          digital_manifest_id: null,
          stripe_checkout_session_id: null,
          stripe_checkout_url: null,
          checkout_attempt_key: attemptKey,
          checkout_request_fingerprint_sha256: args.p_request_fingerprint_sha256,
          created: true
        };
        attempts.set(attemptKey, checkout);
        return { data: checkout, error: null };
      }
      if (name === "stub_checkout_create_paid_order_with_manifest") {
        const checkout = [...attempts.values()].find(
          (candidate) => candidate.id === args.p_checkout_session_id
        );
        if (!checkout) throw new Error("Checkout fixture missing");
        if (checkout.status !== "completed") {
          orderEffects += 1;
          checkout.status = "completed";
          checkout.order_id = orderId;
          cartStatus = "ordered";
        }
        return {
          data: {
            order_id: checkout.order_id,
            total_cents: 2500,
            discount_cents: 0,
            promo_code: null
          },
          error: null
        };
      }
      throw new Error(`Unexpected RPC ${name}`);
    });
    const requestBody = {
      firstName: "Legacy",
      lastName: "Buyer",
      phone: "555-0100",
      email: "legacy@example.com",
      items: [{ variantId: "33333333-3333-4333-8333-333333333333", quantity: 1 }]
    };
    const route = await import("@/app/api/orders/checkout/route");

    const first = await route.POST(buildRequest(requestBody));
    const second = await route.POST(buildRequest(requestBody));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    await expect(first.json()).resolves.toMatchObject({ orderId, status: "paid" });
    await expect(second.json()).resolves.toMatchObject({ orderId, status: "paid" });
    expect(checkoutCreates).toBe(1);
    expect(attempts).toHaveLength(1);
    expect(orderEffects).toBe(1);
  });

  test("returns an already-bound Stripe session without creating another", async () => {
    adminRpcMock.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === "get_storefront_checkout_attempt") {
        return { data: null, error: null };
      }
      if (name === "create_or_reuse_storefront_checkout_attempt") {
        return {
          data: {
            ...(args.p_checkout as Record<string, unknown>),
            id: pendingCheckoutId,
            order_id: null,
            digital_manifest_id: null,
            stripe_checkout_session_id: "cs_test_existing",
            stripe_checkout_url: "https://checkout.stripe.com/pay/cs_test_existing",
            created: false
          },
          error: null
        };
      }
      throw new Error(`Unexpected RPC ${name}`);
    });
    const route = await import("@/app/api/orders/checkout/route");
    const response = await route.POST(
      buildRequest({
        checkoutAttemptId: "018f6fc1-8adc-7f43-8000-000000000003",
        firstName: "Alice",
        lastName: "Buyer",
        phone: "555-0100",
        email: "alice@example.com",
        items: [{ variantId: "33333333-3333-4333-8333-333333333333", quantity: 1 }]
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      mode: "checkout",
      sessionId: "cs_test_existing",
      checkoutUrl: "https://checkout.stripe.com/pay/cs_test_existing"
    });
    expect(stripeCheckoutCreateMock).not.toHaveBeenCalled();
  });

  test("resolves a matching bound attempt before mutable catalog, promo, or Stripe readiness checks", async () => {
    adminRpcMock.mockImplementation(async (name: string) => {
      if (name === "get_storefront_checkout_attempt") {
        return {
          data: {
            id: pendingCheckoutId,
            store_id: checkoutStoreId,
            store_slug: "stripe-shop",
            customer_email: "alice@example.com",
            customer_first_name: "Alice",
            customer_last_name: "Buyer",
            customer_phone: "555-0100",
            customer_note: null,
            fulfillment_method: "shipping",
            fulfillment_label: "Shipping snapshot",
            shipping_fee_cents: 0,
            pickup_location_id: null,
            pickup_location_snapshot_json: null,
            pickup_window_start_at: null,
            pickup_window_end_at: null,
            pickup_timezone: null,
            promo_code: "OLDPROMO",
            promo_codes_json: ["OLDPROMO"],
            applied_promotions_json: [],
            analytics_session_key: null,
            analytics_session_id: null,
            source_cart_id: null,
            fee_plan_key: "standard",
            fee_bps: 500,
            fee_fixed_cents: 0,
            item_total_cents: 2500,
            platform_fee_cents: 125,
            attribution_json: {},
            digital_consent_version: null,
            digital_consent_accepted_at: null,
            digital_license_version: null,
            digital_manifest_id: null,
            items: [{
              productId: "11111111-1111-4111-8111-111111111111",
              variantId: "33333333-3333-4333-8333-333333333333",
              quantity: 1,
              variantLabel: "Standard snapshot",
              productTitle: "Starter Kit snapshot",
              productType: "physical",
              unitPriceCents: 2500
            }],
            order_id: null,
            status: "pending",
            stripe_checkout_session_id: "cs_test_existing",
            stripe_checkout_url: "https://checkout.stripe.com/pay/cs_test_existing",
            checkout_mode: "stripe",
            stripe_account_id_snapshot: "acct_123",
            tax_collection_mode_snapshot: "stripe_tax"
          },
          error: null
        };
      }
      throw new Error(`Unexpected RPC ${name}`);
    });
    getStoreStripePaymentsReadinessMock.mockRejectedValue(new Error("Readiness changed"));
    const route = await import("@/app/api/orders/checkout/route");
    const response = await route.POST(
      buildRequest({
        checkoutAttemptId: "018f6fc1-8adc-7f43-8000-000000000004",
        firstName: "Alice",
        lastName: "Buyer",
        phone: "555-0100",
        email: "alice@example.com",
        items: [{ variantId: "33333333-3333-4333-8333-333333333333", quantity: 1 }]
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      sessionId: "cs_test_existing",
      checkoutUrl: "https://checkout.stripe.com/pay/cs_test_existing"
    });
    expect(getStoreStripePaymentsReadinessMock).not.toHaveBeenCalled();
    expect(stripeCheckoutCreateMock).not.toHaveBeenCalled();
  });

  test("resumes an unbound attempt from its persisted snapshot after catalog and readiness change", async () => {
    adminRpcMock.mockImplementation(async (name: string) => {
      if (name === "get_storefront_checkout_attempt") {
        return {
          data: {
            id: pendingCheckoutId,
            store_id: checkoutStoreId,
            store_slug: "stripe-shop",
            customer_email: "snapshot@example.com",
            customer_first_name: "Snapshot",
            customer_last_name: "Buyer",
            customer_phone: "555-0100",
            customer_note: null,
            fulfillment_method: "shipping",
            fulfillment_label: "Shipping snapshot",
            shipping_fee_cents: 321,
            pickup_location_id: null,
            pickup_location_snapshot_json: null,
            pickup_window_start_at: null,
            pickup_window_end_at: null,
            pickup_timezone: null,
            promo_code: "OLDPROMO",
            promo_codes_json: ["OLDPROMO"],
            applied_promotions_json: [],
            analytics_session_key: null,
            analytics_session_id: null,
            source_cart_id: null,
            fee_plan_key: "standard",
            fee_bps: 500,
            fee_fixed_cents: 0,
            item_total_cents: 2000,
            platform_fee_cents: 125,
            attribution_json: {},
            digital_consent_version: null,
            digital_consent_accepted_at: null,
            digital_license_version: null,
            digital_manifest_id: null,
            items: [{
              productId: "11111111-1111-4111-8111-111111111111",
              variantId: "33333333-3333-4333-8333-333333333333",
              quantity: 1,
              variantLabel: "Archived variant snapshot",
              productTitle: "Archived product snapshot",
              productType: "physical",
              unitPriceCents: 2500
            }],
            order_id: null,
            status: "pending",
            stripe_checkout_session_id: null,
            stripe_checkout_url: null,
            checkout_mode: "stripe",
            stripe_account_id_snapshot: "acct_123",
            tax_collection_mode_snapshot: "seller_attested_no_tax"
          },
          error: null
        };
      }
      if (name === "bind_storefront_checkout_stripe_session") {
        return { data: { id: pendingCheckoutId }, error: null };
      }
      throw new Error(`Unexpected RPC ${name}`);
    });
    getStoreStripePaymentsReadinessMock.mockRejectedValue(new Error("Readiness changed"));
    const route = await import("@/app/api/orders/checkout/route");
    const response = await route.POST(
      buildRequest({
        checkoutAttemptId: "018f6fc1-8adc-7f43-8000-000000000005",
        firstName: "Alice",
        lastName: "Buyer",
        phone: "555-0100",
        email: "alice@example.com",
        promoCode: "OLDPROMO",
        items: [{ variantId: "33333333-3333-4333-8333-333333333333", quantity: 1 }]
      })
    );

    expect(response.status).toBe(200);
    expect(getStoreStripePaymentsReadinessMock).not.toHaveBeenCalled();
    expect(stripeCheckoutCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_email: "snapshot@example.com",
        shipping_options: [expect.objectContaining({
          shipping_rate_data: expect.objectContaining({
            display_name: "Shipping snapshot",
            fixed_amount: { amount: 321, currency: "usd" }
          })
        })],
        line_items: expect.arrayContaining([
          expect.objectContaining({
            price_data: expect.objectContaining({ unit_amount: 2000 })
          })
        ])
      }),
      { idempotencyKey: `storefront-checkout:${pendingCheckoutId}` }
    );
  });
});
