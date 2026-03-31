import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const resolveStoreSlugFromRequestAsyncMock = vi.fn();
const adminFromMock = vi.fn();

vi.mock("@/lib/stores/active-store", () => ({
  resolveStoreSlugFromRequestAsync: (...args: unknown[]) => resolveStoreSlugFromRequestAsyncMock(...args)
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

vi.mock("@/lib/pickup/scheduling", () => ({
  buildPickupSlots: vi.fn(() => [])
}));

function buildRequest() {
  return new NextRequest("http://localhost:3000/api/storefront/pickup-options?store=curby", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
}

beforeEach(() => {
  vi.resetModules();
  resolveStoreSlugFromRequestAsyncMock.mockReset();
  adminFromMock.mockReset();
  resolveStoreSlugFromRequestAsyncMock.mockResolvedValue("curby");

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

    if (table === "store_pickup_settings") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: {
                pickup_enabled: false,
                selection_mode: "buyer_select",
                geolocation_fallback_mode: "disable_pickup",
                out_of_radius_behavior: "disable_pickup",
                eligibility_radius_miles: 10,
                lead_time_hours: 24,
                slot_interval_minutes: 60,
                show_pickup_times: false,
                timezone: "America/New_York",
                instructions: null
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
              returns: vi.fn(async () => ({
                data: [
                  {
                    id: "loc-1",
                    name: "Main pickup",
                    address_line1: "123 Main",
                    address_line2: null,
                    city: "Virginia Beach",
                    state_region: "VA",
                    postal_code: "23451",
                    country_code: "US",
                    latitude: null,
                    longitude: null,
                    is_active: true
                  }
                ],
                error: null
              }))
            }))
          }))
        }))
      };
    }

    if (table === "pickup_location_hours") {
      return {
        select: vi.fn(() => ({
          returns: vi.fn(async () => ({ data: [], error: null }))
        }))
      };
    }

    if (table === "pickup_blackout_dates") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            returns: vi.fn(async () => ({ data: [], error: null }))
          }))
        }))
      };
    }

    throw new Error(`Unexpected table ${table}`);
  });
});

describe("storefront pickup options route", () => {
  test("still returns pickup options when availability rules are disabled", async () => {
    const route = await import("@/app/api/storefront/pickup-options/route");
    const response = await route.POST(buildRequest());
    const payload = (await response.json()) as {
      pickupEnabled: boolean;
      options: Array<{ id: string }>;
    };

    expect(response.status).toBe(200);
    expect(payload.pickupEnabled).toBe(true);
    expect(payload.options).toHaveLength(1);
    expect(payload.options[0]?.id).toBe("loc-1");
  });
});
