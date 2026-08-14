import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const enforceTrustedOriginMock = vi.fn();
const checkRateLimitMock = vi.fn();
const resolveStoreSlugFromRequestAsyncMock = vi.fn();
const resolveStorefrontSessionLinkMock = vi.fn();
const resolveStoreFeeProfileMock = vi.fn();
const calculatePlatformFeeCentsMock = vi.fn();
const getStoreStripePaymentsReadinessMock = vi.fn();
const getStripeClientMock = vi.fn();
const adminFromMock = vi.fn();
const adminRpcMock = vi.fn();
const stripeCheckoutCreateMock = vi.fn();
const createOrReuseCheckoutManifestMock = vi.fn();
const enqueueDigitalDeliveryMock = vi.fn();
const resolveStoreDigitalProductsAccessMock = vi.fn();

vi.mock("@/lib/digital-products/feature-gating", () => ({
  resolveStoreDigitalProductsAccess: (...args: unknown[]) => resolveStoreDigitalProductsAccessMock(...args)
}));

const ids = {
  store: "10000000-0000-4000-8000-000000000001",
  digitalProduct: "20000000-0000-4000-8000-000000000001",
  physicalProduct: "20000000-0000-4000-8000-000000000002",
  digitalVariant: "30000000-0000-4000-8000-000000000001",
  physicalVariant: "30000000-0000-4000-8000-000000000002",
  checkout: "40000000-0000-4000-8000-000000000001",
  manifest: "50000000-0000-4000-8000-000000000001",
  promotion: "60000000-0000-4000-8000-000000000001"
} as const;

type ProductType = "physical" | "digital";

type VariantFixture = {
  id: string;
  productId: string;
  productType: ProductType;
  title: string;
  priceCents: number;
  inventoryQty: number;
  madeToOrder?: boolean;
};

let variants: VariantFixture[];
let settings: {
  checkout_enable_local_pickup: boolean;
  checkout_local_pickup_label: string;
  checkout_local_pickup_fee_cents: number;
  checkout_enable_flat_rate_shipping: boolean;
  checkout_flat_rate_shipping_label: string;
  checkout_flat_rate_shipping_fee_cents: number;
  checkout_allow_order_note: boolean;
  checkout_max_promo_codes: number;
};
let taxMode: "stripe_tax" | "seller_attested_no_tax";
let createdCheckoutSnapshot: Record<string, unknown> | null;
let queriedTables: string[];
let promotions: Array<Record<string, unknown>>;

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
  calculatePlatformFeeCents: (...args: unknown[]) => calculatePlatformFeeCentsMock(...args)
}));
vi.mock("@/lib/notifications/order-emails", () => ({ sendOrderCreatedNotifications: vi.fn() }));
vi.mock("@/lib/digital-products/delivery-jobs", () => ({
  enqueueDigitalDelivery: (...args: unknown[]) => enqueueDigitalDeliveryMock(...args)
}));
vi.mock("@/lib/env", () => ({
  getAppUrl: () => "https://www.myrivo.app",
  isStripeStubMode: () => false
}));
vi.mock("@/lib/stripe/store-payments-readiness", () => ({
  getStoreStripePaymentsReadiness: (...args: unknown[]) => getStoreStripePaymentsReadinessMock(...args)
}));
vi.mock("@/lib/stripe/server", () => ({
  getStripeClient: (...args: unknown[]) => getStripeClientMock(...args)
}));
vi.mock("@/lib/digital-products/manifest-service", () => ({
  createOrReuseCheckoutManifest: (...args: unknown[]) => createOrReuseCheckoutManifestMock(...args),
  buildDigitalManifestStripeMetadata: (manifestId: string) => ({ digital_manifest_id: manifestId }),
  DigitalPurchaseManifestError: class DigitalPurchaseManifestError extends Error {}
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: (...args: unknown[]) => adminFromMock(...args),
    rpc: (...args: unknown[]) => adminRpcMock(...args)
  })
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    from: vi.fn()
  }))
}));

function buildRequest(overrides: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost:3000/api/orders/checkout?store=digital-shop", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      host: "localhost:3000"
    },
    body: JSON.stringify({
      checkoutAttemptId: "018f6fc1-8adc-7f43-8000-000000000601",
      firstName: "Alice",
      lastName: "Buyer",
      phone: "555-0100",
      email: "alice@example.com",
      digitalDeliveryConsent: true,
      items: [{ variantId: ids.digitalVariant, quantity: 1 }],
      ...overrides
    })
  });
}

function variantRow(fixture: VariantFixture) {
  return {
    id: fixture.id,
    product_id: fixture.productId,
    title: fixture.title,
    price_cents: fixture.priceCents,
    inventory_qty: fixture.inventoryQty,
    is_made_to_order: fixture.madeToOrder ?? false,
    status: "active",
    option_values: {},
    products: {
      id: fixture.productId,
      title: fixture.productType === "digital" ? "Printable set" : "Oak frame",
      status: "active",
      store_id: ids.store,
      product_type: fixture.productType
    }
  };
}

function queryResult<T>(data: T) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    returns: vi.fn(async () => ({ data, error: null })),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
    update: vi.fn(() => query),
    then: (resolve: (value: { data: T; error: null }) => unknown) =>
      Promise.resolve({ data, error: null }).then(resolve)
  };
  return query;
}

describe("digital checkout composition", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createdCheckoutSnapshot = null;
    queriedTables = [];
    promotions = [];
    taxMode = "stripe_tax";
    variants = [
      {
        id: ids.digitalVariant,
        productId: ids.digitalProduct,
        productType: "digital",
        title: "Default",
        priceCents: 2400,
        inventoryQty: 0
      },
      {
        id: ids.physicalVariant,
        productId: ids.physicalProduct,
        productType: "physical",
        title: "Oak",
        priceCents: 1600,
        inventoryQty: 3
      }
    ];
    settings = {
      checkout_enable_local_pickup: false,
      checkout_local_pickup_label: "Local pickup",
      checkout_local_pickup_fee_cents: 0,
      checkout_enable_flat_rate_shipping: true,
      checkout_flat_rate_shipping_label: "Shipping",
      checkout_flat_rate_shipping_fee_cents: 700,
      checkout_allow_order_note: true,
      checkout_max_promo_codes: 3
    };

    enforceTrustedOriginMock.mockReturnValue(null);
    checkRateLimitMock.mockResolvedValue(null);
    resolveStoreSlugFromRequestAsyncMock.mockResolvedValue("digital-shop");
    resolveStorefrontSessionLinkMock.mockResolvedValue(null);
    resolveStoreFeeProfileMock.mockResolvedValue({ planKey: "standard", feeBps: 500, feeFixedCents: 0 });
    calculatePlatformFeeCentsMock.mockReturnValue(120);
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
      id: "cs_test_digital",
      url: "https://checkout.stripe.com/pay/cs_test_digital"
    });
    getStripeClientMock.mockReturnValue({ checkout: { sessions: { create: stripeCheckoutCreateMock } } });
    createOrReuseCheckoutManifestMock.mockResolvedValue({ manifestId: ids.manifest, items: [] });
    enqueueDigitalDeliveryMock.mockResolvedValue({ id: "delivery-job-1", status: "pending" });
    resolveStoreDigitalProductsAccessMock.mockResolvedValue({ enabled: true, planEligible: true, storeEnabled: true, planKey: "test" });

    adminRpcMock.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === "get_storefront_checkout_attempt") return { data: null, error: null };
      if (name === "create_or_reuse_storefront_checkout_attempt") {
        createdCheckoutSnapshot = args.p_checkout as Record<string, unknown>;
        return {
          data: {
            ...createdCheckoutSnapshot,
            id: ids.checkout,
            store_id: ids.store,
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
      if (name === "bind_storefront_checkout_stripe_session") return { data: {}, error: null };
      throw new Error(`Unexpected RPC ${name}`);
    });

    adminFromMock.mockImplementation((table: string) => {
      queriedTables.push(table);
      if (table === "stores") {
        return queryResult({
          id: ids.store,
          name: "Digital Shop",
          slug: "digital-shop",
          status: "live",
          stripe_account_id: "acct_123",
          tax_collection_mode: taxMode
        });
      }
      if (table === "product_variants") return queryResult(variants.map(variantRow));
      if (table === "store_settings") return queryResult(settings);
      if (table === "store_pickup_settings") {
        return queryResult({
          pickup_enabled: false,
          selection_mode: "buyer_select",
          geolocation_fallback_mode: "allow_without_distance",
          out_of_radius_behavior: "allow_all_locations",
          eligibility_radius_miles: 100,
          lead_time_hours: 24,
          slot_interval_minutes: 60,
          show_pickup_times: false,
          timezone: "America/New_York"
        });
      }
      if (table === "pickup_locations") return queryResult([]);
      if (table === "promotions") return queryResult(promotions);
      if (table === "promotion_redemptions") return queryResult([]);
      if (table === "storefront_checkout_sessions") return queryResult(null);
      throw new Error(`Unexpected table ${table}`);
    });
  });

  test("digital-only checkout ignores zero inventory and physical fulfillment configuration", async () => {
    settings.checkout_enable_local_pickup = true;
    settings.checkout_enable_flat_rate_shipping = false;
    const route = await import("@/app/api/orders/checkout/route");

    const response = await route.POST(buildRequest());

    expect(response.status).toBe(200);
    expect(queriedTables).not.toContain("store_pickup_settings");
    expect(queriedTables).not.toContain("pickup_locations");
    expect(createdCheckoutSnapshot).toMatchObject({
      checkout_composition: "digital_only",
      customer_phone: null,
      fulfillment_method: "digital_delivery",
      fulfillment_label: "Digital delivery",
      shipping_fee_cents: 0,
      pickup_location_id: null,
      pickup_location_snapshot_json: null,
      pickup_window_start_at: null,
      pickup_window_end_at: null,
      pickup_timezone: null
    });
    const stripePayload = stripeCheckoutCreateMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(stripePayload).toMatchObject({ automatic_tax: { enabled: true } });
    expect(stripePayload.success_url).toBe(
      "https://www.myrivo.app/s/digital-shop/checkout?status=success&session_id={CHECKOUT_SESSION_ID}&checkoutComposition=digital_only"
    );
    expect(stripePayload).not.toHaveProperty("billing_address_collection");
    expect(stripePayload).not.toHaveProperty("shipping_address_collection");
    expect(stripePayload).not.toHaveProperty("shipping_options");
  });

  test("rejects a new digital checkout when its billing plan is inactive", async () => {
    resolveStoreDigitalProductsAccessMock.mockResolvedValue({
      enabled: false,
      planEligible: false,
      storeEnabled: true,
      planKey: "standard"
    });
    const route = await import("@/app/api/orders/checkout/route");
    const response = await route.POST(buildRequest());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Digital products are no longer available for checkout."
    });
    expect(stripeCheckoutCreateMock).not.toHaveBeenCalled();
  });

  test("repairs durable delivery when a completed Stripe checkout is resumed", async () => {
    adminRpcMock.mockImplementation(async (name: string) => {
      if (name === "get_storefront_checkout_attempt") {
        return {
          data: {
            id: ids.checkout,
            store_id: ids.store,
            store_slug: "digital-shop",
            customer_email: "alice@example.com",
            customer_first_name: "Alice",
            customer_last_name: "Buyer",
            customer_phone: null,
            customer_note: null,
            fulfillment_method: "digital_delivery",
            fulfillment_label: "Digital delivery",
            shipping_fee_cents: 0,
            pickup_location_id: null,
            pickup_location_snapshot_json: null,
            pickup_window_start_at: null,
            pickup_window_end_at: null,
            pickup_timezone: null,
            promo_code: null,
            promo_codes_json: [],
            applied_promotions_json: [],
            analytics_session_key: null,
            analytics_session_id: null,
            source_cart_id: null,
            fee_plan_key: "standard",
            fee_bps: 600,
            fee_fixed_cents: 30,
            item_total_cents: 2400,
            platform_fee_cents: 174,
            attribution_json: {},
            items: [{
              productId: ids.digitalProduct,
              variantId: ids.digitalVariant,
              productTitle: "Printable set",
              variantLabel: "Default",
              productType: "digital",
              unitPriceCents: 2400,
              quantity: 1
            }],
            checkout_composition: "digital_only",
            digital_consent_version: "immediate-delivery-v1",
            digital_consent_accepted_at: "2026-08-13T04:00:00.000Z",
            digital_license_version: "personal-use-v1",
            digital_manifest_id: ids.manifest,
            checkout_mode: "stripe",
            stripe_account_id_snapshot: "acct_123",
            tax_collection_mode_snapshot: "stripe_tax",
            status: "completed",
            order_id: "70000000-0000-4000-8000-000000000001",
            stripe_checkout_session_id: "cs_test_completed",
            stripe_checkout_url: "https://checkout.stripe.test/completed",
            checkout_attempt_key: "018f6fc1-8adc-7f43-8000-000000000601",
            checkout_request_fingerprint_sha256: "a".repeat(64),
            created: false
          },
          error: null
        };
      }
      throw new Error(`Unexpected RPC ${name}`);
    });

    const route = await import("@/app/api/orders/checkout/route");
    const response = await route.POST(buildRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      orderId: "70000000-0000-4000-8000-000000000001",
      status: "paid",
      paymentMode: "stripe"
    });
    expect(enqueueDigitalDeliveryMock).toHaveBeenCalledWith(
      "70000000-0000-4000-8000-000000000001",
      ids.manifest
    );
  });

  test("rejects an aggregated duplicate digital line instead of selling quantity two", async () => {
    const route = await import("@/app/api/orders/checkout/route");
    const response = await route.POST(buildRequest({
      items: [
        { variantId: ids.digitalVariant, quantity: 1 },
        { variantId: ids.digitalVariant, quantity: 1 }
      ]
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Digital products have a quantity of one." });
    expect(stripeCheckoutCreateMock).not.toHaveBeenCalled();
  });

  test("rejects physical lines without inventory while still accepting digital zero inventory", async () => {
    variants.find((variant) => variant.id === ids.physicalVariant)!.inventoryQty = 0;
    const route = await import("@/app/api/orders/checkout/route");
    const response = await route.POST(buildRequest({
      items: [{ variantId: ids.physicalVariant, quantity: 1 }]
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("Insufficient inventory") });
    expect(stripeCheckoutCreateMock).not.toHaveBeenCalled();
  });

  test("mixed checkout retains shipping, phone, address collection, and digital consent", async () => {
    const route = await import("@/app/api/orders/checkout/route");
    const response = await route.POST(buildRequest({
      fulfillmentMethod: "shipping",
      items: [
        { variantId: ids.digitalVariant, quantity: 1 },
        { variantId: ids.physicalVariant, quantity: 2 }
      ]
    }));

    expect(response.status).toBe(200);
    expect(createdCheckoutSnapshot).toMatchObject({
      checkout_composition: "mixed",
      customer_phone: "555-0100",
      fulfillment_method: "shipping",
      shipping_fee_cents: 700
    });
    const stripePayload = stripeCheckoutCreateMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(stripePayload).toMatchObject({
      success_url: "https://www.myrivo.app/s/digital-shop/checkout?status=success&session_id={CHECKOUT_SESSION_ID}&checkoutComposition=mixed",
      billing_address_collection: "auto",
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: [expect.objectContaining({
        shipping_rate_data: expect.objectContaining({ fixed_amount: { amount: 700, currency: "usd" } })
      })]
    });
  });

  test("requires phone and consent only for the compositions that need them", async () => {
    const route = await import("@/app/api/orders/checkout/route");
    const missingPhone = await route.POST(buildRequest({
      phone: "",
      digitalDeliveryConsent: false,
      items: [{ variantId: ids.physicalVariant, quantity: 1 }]
    }));
    expect(missingPhone.status).toBe(400);
    await expect(missingPhone.json()).resolves.toEqual({ error: "Phone is required for physical fulfillment." });

    const missingConsent = await route.POST(buildRequest({
      digitalDeliveryConsent: false,
      items: [{ variantId: ids.digitalVariant, quantity: 1 }]
    }));
    expect(missingConsent.status).toBe(400);
    await expect(missingConsent.json()).resolves.toEqual({ error: "Confirm immediate digital delivery before checkout." });
  });

  test("applies free shipping to mixed checkout without changing its physical composition", async () => {
    promotions = [{
      id: ids.promotion,
      code: "SHIPFREE",
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
    }];
    const route = await import("@/app/api/orders/checkout/route");
    const response = await route.POST(buildRequest({
      fulfillmentMethod: "shipping",
      promoCode: "SHIPFREE",
      items: [
        { variantId: ids.digitalVariant, quantity: 1 },
        { variantId: ids.physicalVariant, quantity: 1 }
      ]
    }));

    expect(response.status).toBe(200);
    expect(createdCheckoutSnapshot).toMatchObject({ checkout_composition: "mixed", shipping_fee_cents: 0 });
    const stripePayload = stripeCheckoutCreateMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(stripePayload).toMatchObject({
      shipping_options: [expect.objectContaining({
        shipping_rate_data: expect.objectContaining({ fixed_amount: { amount: 0, currency: "usd" } })
      })]
    });
  });
});
