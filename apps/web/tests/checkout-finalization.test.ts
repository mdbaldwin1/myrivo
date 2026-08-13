import { beforeEach, describe, expect, test, vi } from "vitest";

const adminFromMock = vi.fn();
const resolveStoreFeeProfileMock = vi.fn();
const calculatePlatformFeeCentsMock = vi.fn();
const writeOrderFeeBreakdownMock = vi.fn();
const sendOrderCreatedNotificationsMock = vi.fn();
const persistPromotionRedemptionsMock = vi.fn();
const lockManifestToOrderMock = vi.fn();
const enqueueDigitalDeliveryMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

vi.mock("@/lib/billing/fees", () => ({
  resolveStoreFeeProfile: (...args: unknown[]) => resolveStoreFeeProfileMock(...args),
  calculatePlatformFeeCents: (...args: unknown[]) => calculatePlatformFeeCentsMock(...args),
  writeOrderFeeBreakdown: (...args: unknown[]) => writeOrderFeeBreakdownMock(...args)
}));

vi.mock("@/lib/notifications/order-emails", () => ({
  sendOrderCreatedNotifications: (...args: unknown[]) => sendOrderCreatedNotificationsMock(...args)
}));

vi.mock("@/lib/promotions/persist-redemptions", () => ({
  persistPromotionRedemptions: (...args: unknown[]) => persistPromotionRedemptionsMock(...args)
}));

vi.mock("@/lib/digital-products/manifest-service", () => ({
  lockManifestToOrder: (...args: unknown[]) => lockManifestToOrderMock(...args)
}));

vi.mock("@/lib/digital-products/delivery-jobs", () => ({
  enqueueDigitalDelivery: (...args: unknown[]) => enqueueDigitalDeliveryMock(...args)
}));

vi.mock("@/lib/env", () => ({
  isStripeStubMode: () => false
}));

vi.mock("@/lib/stores/lifecycle", () => ({
  isStorePubliclyAccessibleStatus: (status: string) => status === "live"
}));

describe("finalizeStorefrontCheckout", () => {
  beforeEach(() => {
    vi.resetModules();
    adminFromMock.mockReset();
    resolveStoreFeeProfileMock.mockReset();
    calculatePlatformFeeCentsMock.mockReset();
    writeOrderFeeBreakdownMock.mockReset();
    sendOrderCreatedNotificationsMock.mockReset();
    persistPromotionRedemptionsMock.mockReset();
    lockManifestToOrderMock.mockReset();
    enqueueDigitalDeliveryMock.mockReset();

    resolveStoreFeeProfileMock.mockResolvedValue({
      planKey: "growth",
      feeBps: 500,
      feeFixedCents: 0
    });
    calculatePlatformFeeCentsMock.mockReturnValue(250);
    writeOrderFeeBreakdownMock.mockResolvedValue(undefined);
    sendOrderCreatedNotificationsMock.mockResolvedValue(undefined);
    persistPromotionRedemptionsMock.mockResolvedValue(undefined);
    lockManifestToOrderMock.mockResolvedValue(undefined);
    enqueueDigitalDeliveryMock.mockResolvedValue({ id: "delivery-job-1", status: "pending" });
  });

  test("extracts Stripe-collected shipping details from the current Checkout Session shape", async () => {
    const { extractShippingAddressSnapshot } = await import("@/lib/storefront/checkout-finalization");

    expect(
      extractShippingAddressSnapshot({
        collected_information: {
          shipping_details: {
            name: "Sandra Terwey",
            address: {
              line1: "44 Garden Way",
              line2: null,
              city: "Nashville",
              state: "TN",
              postal_code: "37201",
              country: "us"
            }
          }
        }
      })
    ).toEqual({
      recipientName: "Sandra Terwey",
      addressLine1: "44 Garden Way",
      city: "Nashville",
      stateRegion: "TN",
      postalCode: "37201",
      countryCode: "US"
    });
  });

  test("discards address data when finalizing a digital-only checkout", async () => {
    const { resolveCheckoutShippingAddressSnapshot } = await import("@/lib/storefront/checkout-finalization");
    const address = {
      recipientName: "Alice Buyer",
      addressLine1: "123 Main Street",
      city: "Richmond",
      stateRegion: "VA",
      postalCode: "23220",
      countryCode: "US"
    };

    expect(resolveCheckoutShippingAddressSnapshot("digital_only", address, address)).toBeNull();
    expect(resolveCheckoutShippingAddressSnapshot("mixed", null, address)).toEqual(address);
  });

  test("repairs a completed digital checkout by ensuring its durable delivery job", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table !== "storefront_checkout_sessions") {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: {
                id: "checkout-completed",
                store_id: "store-1",
                store_slug: "digital-shop",
                analytics_session_id: null,
                analytics_session_key: null,
                source_cart_id: null,
                customer_email: "buyer@example.com",
                customer_first_name: "Digital",
                customer_last_name: "Buyer",
                customer_phone: null,
                customer_note: null,
                shipping_address_json: null,
                fulfillment_method: "digital_delivery",
                fulfillment_label: "Digital delivery",
                pickup_location_id: null,
                pickup_location_snapshot_json: null,
                pickup_window_start_at: null,
                pickup_window_end_at: null,
                pickup_timezone: null,
                shipping_fee_cents: 0,
                promo_code: null,
                promo_codes_json: [],
                fee_plan_key: "standard",
                fee_bps: 600,
                fee_fixed_cents: 30,
                item_total_cents: 2400,
                platform_fee_cents: 174,
                digital_consent_version: "immediate-delivery-v1",
                digital_consent_accepted_at: "2026-08-13T04:00:00.000Z",
                digital_license_version: "personal-use-v1",
                digital_manifest_id: "manifest-1",
                checkout_composition: "digital_only",
                items: [],
                order_id: "order-1",
                status: "completed"
              },
              error: null
            }))
          }))
        }))
      };
    });

    const { finalizeStorefrontCheckout } = await import("@/lib/storefront/checkout-finalization");

    await expect(finalizeStorefrontCheckout("checkout-completed", "pi_paid")).resolves.toEqual({
      status: "completed",
      orderId: "order-1"
    });
    expect(lockManifestToOrderMock).toHaveBeenCalledWith("manifest-1", "order-1");
    expect(enqueueDigitalDeliveryMock).toHaveBeenCalledWith("order-1", "manifest-1");
  });

  test("persists the Stripe shipping address onto the order and checkout session", async () => {
    const orderUpdateMock = vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null }))
    }));
    const checkoutSessionUpdateMock = vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null }))
    }));

    adminFromMock.mockImplementation((table: string) => {
      if (table === "storefront_checkout_sessions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: "checkout-1",
                  store_id: "store-1",
                  store_slug: "at-home-apothecary",
                  analytics_session_id: null,
                  analytics_session_key: null,
                  source_cart_id: null,
                  customer_email: "buyer@example.com",
                  customer_first_name: "Rachel",
                  customer_last_name: "Buyer",
                  customer_phone: null,
                  customer_note: null,
                  shipping_address_json: null,
                  fulfillment_method: "shipping",
                  fulfillment_label: "Shipping",
                  pickup_location_id: null,
                  pickup_location_snapshot_json: null,
                  pickup_window_start_at: null,
                  pickup_window_end_at: null,
                  pickup_timezone: null,
                  shipping_fee_cents: 500,
                  promo_code: null,
                  promo_codes_json: [],
                  fee_plan_key: "growth",
                  fee_bps: 500,
                  fee_fixed_cents: 0,
                  item_total_cents: 3000,
                  platform_fee_cents: 250,
                  items: [],
                  order_id: null,
                  status: "pending"
                },
                error: null
              }))
            }))
          })),
          update: checkoutSessionUpdateMock
        };
      }

      if (table === "stores") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { status: "live" },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "orders") {
        return {
          select: vi.fn((columns: string) => {
            if (columns === "id") {
              return {
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: "order-1" },
                    error: null
                  }))
                }))
              };
            }

            if (columns === "subtotal_cents,discount_cents") {
              return {
                eq: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: { subtotal_cents: 3000, discount_cents: 0 },
                    error: null
                  }))
                }))
              };
            }

            throw new Error(`Unexpected orders select ${columns}`);
          }),
          update: orderUpdateMock
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { finalizeStorefrontCheckout } = await import("@/lib/storefront/checkout-finalization");
    const result = await finalizeStorefrontCheckout("checkout-1", "pi_123", {
      shipping_details: {
        name: "Bruce Baldwin",
        address: {
          line1: "12 Main St",
          line2: null,
          city: "Nashville",
          state: "TN",
          postal_code: "37201",
          country: "US"
        }
      }
    });

    expect(result).toEqual({ status: "completed", orderId: "order-1" });
    expect(orderUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        shipping_address_json: {
          recipientName: "Bruce Baldwin",
          addressLine1: "12 Main St",
          city: "Nashville",
          stateRegion: "TN",
          postalCode: "37201",
          countryCode: "US"
        }
      })
    );
    expect(checkoutSessionUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        shipping_address_json: {
          recipientName: "Bruce Baldwin",
          addressLine1: "12 Main St",
          city: "Nashville",
          stateRegion: "TN",
          postalCode: "37201",
          countryCode: "US"
        }
      })
    );
  });

  test.each(["suspended", "removed"] as const)(
    "finalizes an already-paid checkout after the store becomes %s",
    async (storeStatus) => {
      const checkoutSessionUpdateMock = vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null }))
      }));
      adminFromMock.mockImplementation((table: string) => {
        if (table === "storefront_checkout_sessions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "checkout-paid",
                    store_id: "store-1",
                    store_slug: "at-home-apothecary",
                    analytics_session_id: null,
                    analytics_session_key: null,
                    source_cart_id: null,
                    customer_email: "buyer@example.com",
                    customer_first_name: "Paid",
                    customer_last_name: "Buyer",
                    customer_phone: null,
                    customer_note: null,
                    shipping_address_json: null,
                    fulfillment_method: "shipping",
                    fulfillment_label: "Shipping",
                    pickup_location_id: null,
                    pickup_location_snapshot_json: null,
                    pickup_window_start_at: null,
                    pickup_window_end_at: null,
                    pickup_timezone: null,
                    shipping_fee_cents: 0,
                    promo_code: null,
                    promo_codes_json: [],
                    fee_plan_key: "growth",
                    fee_bps: 500,
                    fee_fixed_cents: 0,
                    item_total_cents: 3000,
                    platform_fee_cents: 150,
                    digital_consent_version: null,
                    digital_consent_accepted_at: null,
                    digital_license_version: null,
                    digital_manifest_id: null,
                    items: [],
                    order_id: null,
                    status: "pending"
                  },
                  error: null
                }))
              }))
            })),
            update: checkoutSessionUpdateMock
          };
        }
        if (table === "stores") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: { status: storeStatus }, error: null }))
              }))
            }))
          };
        }
        if (table === "orders") {
          return {
            select: vi.fn((columns: string) => {
              if (columns === "id") {
                return {
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: { id: "order-paid" }, error: null }))
                  }))
                };
              }
              return {
                eq: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: { subtotal_cents: 3000, discount_cents: 0 },
                    error: null
                  }))
                }))
              };
            }),
            update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }))
          };
        }
        throw new Error(`Unexpected table ${table}`);
      });

      const { finalizeStorefrontCheckout } = await import("@/lib/storefront/checkout-finalization");
      const result = await finalizeStorefrontCheckout("checkout-paid", "pi_paid");

      expect(result).toEqual({ status: "completed", orderId: "order-paid" });
      expect(checkoutSessionUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          order_id: "order-paid",
          stripe_payment_intent_id: "pi_paid"
        })
      );
    }
  );
});
