import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const authGetUserMock = vi.fn();
const serverFromMock = vi.fn();
const getOwnedStoreBundleMock = vi.fn();
const enforceTrustedOriginMock = vi.fn();
const logAuditEventMock = vi.fn();
const sendOrderPickupUpdatedNotificationMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: (...args: unknown[]) => authGetUserMock(...args) },
    from: (...args: unknown[]) => serverFromMock(...args)
  }))
}));

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundle: (...args: unknown[]) => getOwnedStoreBundleMock(...args)
}));

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: (...args: unknown[]) => logAuditEventMock(...args)
}));

vi.mock("@/lib/notifications/order-emails", () => ({
  sendOrderPickupUpdatedNotification: (...args: unknown[]) => sendOrderPickupUpdatedNotificationMock(...args)
}));

beforeEach(() => {
  vi.resetModules();
  authGetUserMock.mockReset();
  serverFromMock.mockReset();
  getOwnedStoreBundleMock.mockReset();
  enforceTrustedOriginMock.mockReset();
  logAuditEventMock.mockReset();
  sendOrderPickupUpdatedNotificationMock.mockReset();

  authGetUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  getOwnedStoreBundleMock.mockResolvedValue({ store: { id: "store-1", slug: "at-home-apothecary" } });
  enforceTrustedOriginMock.mockReturnValue(null);
});

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const OLD_LOCATION_ID = "22222222-2222-4222-8222-222222222222";
const NEW_LOCATION_ID = "33333333-3333-4333-8333-333333333333";

function buildTomorrowSlot() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const start = new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 10, 0, 0, 0));
  const end = new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 10, 30, 0, 0));
  return {
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    dayOfWeek: tomorrow.getUTCDay()
  };
}

describe("order pickup override route", () => {
  test("updates a pickup order, audits the change, and notifies the customer", async () => {
    const slot = buildTomorrowSlot();

    serverFromMock.mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: ORDER_ID,
                    store_id: "store-1",
                    fulfillment_method: "pickup",
                    fulfillment_status: "pending_fulfillment",
                    pickup_location_id: OLD_LOCATION_ID,
                    pickup_location_snapshot_json: {
                      id: OLD_LOCATION_ID,
                      name: "Old location",
                      addressLine1: "123 Old St",
                      city: "Oldtown",
                      stateRegion: "NC",
                      postalCode: "28202",
                      countryCode: "US"
                    },
                    pickup_window_start_at: "2026-03-10T10:00:00.000Z",
                    pickup_window_end_at: "2026-03-10T10:30:00.000Z",
                    pickup_timezone: "UTC"
                  },
                  error: null
                }))
              }))
            }))
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: {
                      id: ORDER_ID,
                      customer_email: "buyer@example.com",
                      subtotal_cents: 3000,
                      total_cents: 3000,
                      status: "paid",
                      fulfillment_method: "pickup",
                      fulfillment_label: "Porch pickup",
                      fulfillment_status: "pending_fulfillment",
                      pickup_location_id: NEW_LOCATION_ID,
                      pickup_window_start_at: slot.startsAt,
                      pickup_window_end_at: slot.endsAt,
                      pickup_timezone: "UTC",
                      discount_cents: 0,
                      promo_code: null,
                      carrier: null,
                      tracking_number: null,
                      tracking_url: null,
                      shipment_status: null,
                      created_at: "2026-03-01T00:00:00.000Z",
                      order_fee_breakdowns: null
                    },
                    error: null
                  }))
                }))
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
                  pickup_enabled: true,
                  selection_mode: "buyer_select",
                  lead_time_hours: 0,
                  slot_interval_minutes: 30,
                  show_pickup_times: true,
                  timezone: "UTC"
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
                      id: NEW_LOCATION_ID,
                      name: "Front porch",
                      address_line1: "12 Main St",
                      address_line2: null,
                      city: "Charlotte",
                      state_region: "NC",
                      postal_code: "28203",
                      country_code: "US",
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
            eq: vi.fn(() => ({
              returns: vi.fn(async () => ({
                data: [
                  {
                    pickup_location_id: NEW_LOCATION_ID,
                    day_of_week: slot.dayOfWeek,
                    opens_at: "10:00",
                    closes_at: "12:00"
                  }
                ],
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
              returns: vi.fn(async () => ({
                data: [],
                error: null
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/orders/pickup-override/route");
    const request = new NextRequest("http://localhost:3000/api/orders/pickup-override", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({
        orderId: ORDER_ID,
        locationId: NEW_LOCATION_ID,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        reason: "Customer requested a different pickup window."
      })
    });

    const response = await route.POST(request);
    const payload = (await response.json()) as { order?: { pickup_location_id: string } };

    expect(response.status).toBe(200);
    expect(payload.order?.pickup_location_id).toBe(NEW_LOCATION_ID);
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
    expect(sendOrderPickupUpdatedNotificationMock).toHaveBeenCalledTimes(1);
    expect(sendOrderPickupUpdatedNotificationMock).toHaveBeenCalledWith(
      ORDER_ID,
      expect.objectContaining({
        reason: "Customer requested a different pickup window."
      })
    );
  });

  test("rejects override attempts for delivered pickup orders", async () => {
    serverFromMock.mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: ORDER_ID,
                    store_id: "store-1",
                    fulfillment_method: "pickup",
                    fulfillment_status: "delivered",
                    pickup_location_id: OLD_LOCATION_ID,
                    pickup_location_snapshot_json: null,
                    pickup_window_start_at: null,
                    pickup_window_end_at: null,
                    pickup_timezone: "UTC"
                  },
                  error: null
                }))
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
                  pickup_enabled: true,
                  selection_mode: "buyer_select",
                  lead_time_hours: 0,
                  slot_interval_minutes: 30,
                  show_pickup_times: true,
                  timezone: "UTC"
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

      if (table === "pickup_location_hours") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              returns: vi.fn(async () => ({ data: [], error: null }))
            }))
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

    const route = await import("@/app/api/orders/pickup-override/route");
    const request = new NextRequest("http://localhost:3000/api/orders/pickup-override", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({
        orderId: ORDER_ID,
        locationId: OLD_LOCATION_ID,
        startsAt: "2026-03-20T10:00:00.000Z",
        endsAt: "2026-03-20T10:30:00.000Z",
        reason: "Need to move it."
      })
    });

    const response = await route.POST(request);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/Delivered pickup orders cannot be changed/i);
    expect(logAuditEventMock).not.toHaveBeenCalled();
    expect(sendOrderPickupUpdatedNotificationMock).not.toHaveBeenCalled();
  });
});
