import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

type PickupSettingsRecord = {
  pickup_enabled: boolean;
  selection_mode: "buyer_select" | "hidden_nearest";
  geolocation_fallback_mode: "allow_without_distance" | "disable_pickup";
  out_of_radius_behavior: "disable_pickup" | "allow_all_locations";
  eligibility_radius_miles: number;
  lead_time_hours: number;
  slot_interval_minutes: number;
  show_pickup_times: boolean;
  timezone: string;
};

type PickupLocationRecord = {
  id: string;
  name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state_region: string;
  postal_code: string;
  country_code: string;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
};

const enforceTrustedOriginMock = vi.fn();
const checkRateLimitMock = vi.fn();
const resolveStoreSlugFromRequestAsyncMock = vi.fn();
const buildPickupSlotsMock = vi.fn();
const adminFromMock = vi.fn();

let pickupSettingsFixture: PickupSettingsRecord;
let pickupLocationsFixture: PickupLocationRecord[];

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args)
}));

vi.mock("@/lib/stores/active-store", () => ({
  resolveStoreSlugFromRequestAsync: (...args: unknown[]) => resolveStoreSlugFromRequestAsyncMock(...args)
}));

vi.mock("@/lib/pickup/scheduling", () => ({
  buildPickupSlots: (...args: unknown[]) => buildPickupSlotsMock(...args)
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

function buildRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/orders/checkout?store=curby", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      host: "localhost:3000"
    },
    body: JSON.stringify(body)
  });
}

function setupSupabaseFixtures() {
  adminFromMock.mockImplementation((table: string) => {
    if (table === "stores") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: "store-1",
                  name: "Curby",
                  slug: "curby",
                  status: "active",
                  mode: "sandbox",
                  stripe_account_id: null
                },
                error: null
              }))
            }))
          }))
        }))
      };
    }

    if (table === "store_billing_profiles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: { test_mode_enabled: true }, error: null }))
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
                checkout_enable_local_pickup: true,
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
            maybeSingle: vi.fn(async () => ({ data: pickupSettingsFixture, error: null }))
          }))
        }))
      };
    }

    if (table === "pickup_locations") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              returns: vi.fn(async () => ({ data: pickupLocationsFixture, error: null }))
            }))
          }))
        }))
      };
    }

    if (table === "pickup_location_hours") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            returns: vi.fn(async () => ({
              data: [{ pickup_location_id: pickupLocationsFixture[0]?.id ?? "", day_of_week: 1, opens_at: "09:00", closes_at: "17:00" }],
              error: null
            }))
          }))
        }))
      };
    }

    if (table === "pickup_blackout_dates") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            or: vi.fn(() => ({
              returns: vi.fn(async () => ({ data: [], error: null }))
            }))
          }))
        }))
      };
    }

    throw new Error(`Unexpected table ${table}`);
  });
}

beforeEach(() => {
  vi.resetModules();
  enforceTrustedOriginMock.mockReset();
  checkRateLimitMock.mockReset();
  resolveStoreSlugFromRequestAsyncMock.mockReset();
  buildPickupSlotsMock.mockReset();
  adminFromMock.mockReset();

  enforceTrustedOriginMock.mockReturnValue(null);
  checkRateLimitMock.mockReturnValue(null);
  resolveStoreSlugFromRequestAsyncMock.mockResolvedValue("curby");
  buildPickupSlotsMock.mockReturnValue([
    {
      startsAt: "2030-04-01T13:00:00.000Z",
      endsAt: "2030-04-01T14:00:00.000Z",
      label: "Apr 1, 1:00 PM - 2:00 PM"
    }
  ]);

  pickupSettingsFixture = {
    pickup_enabled: true,
    selection_mode: "buyer_select",
    geolocation_fallback_mode: "allow_without_distance",
    out_of_radius_behavior: "disable_pickup",
    eligibility_radius_miles: 10,
    lead_time_hours: 48,
    slot_interval_minutes: 60,
    show_pickup_times: true,
    timezone: "America/New_York"
  };

  pickupLocationsFixture = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Main pickup",
      address_line1: "123 Main",
      address_line2: null,
      city: "Virginia Beach",
      state_region: "VA",
      postal_code: "23451",
      country_code: "US",
      latitude: 36.8529,
      longitude: -76.001,
      is_active: true
    }
  ];

  setupSupabaseFixtures();
});

describe("checkout pickup enforcement", () => {
  test("rejects pickup when buyer is outside radius and strict out-of-radius behavior is configured", async () => {
    pickupSettingsFixture.out_of_radius_behavior = "disable_pickup";
    pickupSettingsFixture.eligibility_radius_miles = 5;

    const route = await import("@/app/api/orders/checkout/route");
    const response = await route.POST(
      buildRequest({
        firstName: "Alice",
        lastName: "Buyer",
        email: "alice@example.com",
        fulfillmentMethod: "pickup",
        buyerLatitude: 34.0522,
        buyerLongitude: -118.2437,
        pickupLocationId: "11111111-1111-4111-8111-111111111111",
        items: [{ variantId: "22222222-2222-4222-8222-222222222222", quantity: 1 }]
      })
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("No pickup locations are available within 5 miles.");
  });

  test("rejects pickup when pickup slots are required but no slot is selected", async () => {
    const route = await import("@/app/api/orders/checkout/route");
    const response = await route.POST(
      buildRequest({
        firstName: "Alice",
        lastName: "Buyer",
        email: "alice@example.com",
        fulfillmentMethod: "pickup",
        buyerLatitude: 36.8508,
        buyerLongitude: -76.05,
        pickupLocationId: "11111111-1111-4111-8111-111111111111",
        items: [{ variantId: "22222222-2222-4222-8222-222222222222", quantity: 1 }]
      })
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Select a pickup time window.");
  });

  test("rejects pickup when selected slot is no longer valid", async () => {
    const route = await import("@/app/api/orders/checkout/route");
    const response = await route.POST(
      buildRequest({
        firstName: "Alice",
        lastName: "Buyer",
        email: "alice@example.com",
        fulfillmentMethod: "pickup",
        buyerLatitude: 36.8508,
        buyerLongitude: -76.05,
        pickupLocationId: "11111111-1111-4111-8111-111111111111",
        pickupWindowStartAt: "2030-04-01T15:00:00.000Z",
        pickupWindowEndAt: "2030-04-01T16:00:00.000Z",
        items: [{ variantId: "22222222-2222-4222-8222-222222222222", quantity: 1 }]
      })
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Selected pickup time is no longer available. Please choose another slot.");
  });
});
