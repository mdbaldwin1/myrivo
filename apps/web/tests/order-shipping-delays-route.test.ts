import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const authGetUserMock = vi.fn();
const getOwnedStoreBundleMock = vi.fn();
const enforceTrustedOriginMock = vi.fn();
const logAuditEventMock = vi.fn();
const serverFromMock = vi.fn();
const sendOrderShippingDelayNotificationMock = vi.fn();

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
  sendOrderShippingDelayNotification: (...args: unknown[]) => sendOrderShippingDelayNotificationMock(...args)
}));

const ORDER_ID = "99999999-9999-4999-8999-999999999999";

beforeEach(() => {
  vi.resetModules();
  authGetUserMock.mockReset();
  getOwnedStoreBundleMock.mockReset();
  enforceTrustedOriginMock.mockReset();
  logAuditEventMock.mockReset();
  serverFromMock.mockReset();
  sendOrderShippingDelayNotificationMock.mockReset();

  authGetUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  getOwnedStoreBundleMock.mockResolvedValue({ store: { id: "store-1", slug: "at-home-apothecary" } });
  enforceTrustedOriginMock.mockReturnValue(null);
  sendOrderShippingDelayNotificationMock.mockResolvedValue(undefined);
});

describe("order shipping delays route", () => {
  test("records a shipping delay for a shipping order", async () => {
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
                    fulfillment_method: "shipping",
                    fulfillment_status: "packing"
                  },
                  error: null
                }))
              }))
            }))
          }))
        };
      }

      if (table === "order_shipping_delays") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                neq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: null, error: null }))
                  }))
                }))
              }))
            }))
          })),
          insert: vi.fn((payload: Record<string, unknown>) => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: "delay-1",
                  order_id: ORDER_ID,
                  store_id: "store-1",
                  created_by_user_id: "user-1",
                  resolved_by_user_id: null,
                  status: payload.status,
                  reason_key: payload.reason_key,
                  customer_path: payload.customer_path,
                  original_ship_promise: payload.original_ship_promise,
                  revised_ship_date: payload.revised_ship_date,
                  internal_note: payload.internal_note,
                  resolution_note: null,
                  metadata_json: {},
                  resolved_at: null,
                  created_at: "2026-03-13T22:30:00.000Z",
                  updated_at: "2026-03-13T22:30:00.000Z"
                },
                error: null
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/orders/shipping-delays/route");
    const response = await route.POST(
      new NextRequest("http://localhost:3000/api/orders/shipping-delays", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          orderId: ORDER_ID,
          reasonKey: "carrier_disruption",
          customerPath: "request_delay_approval",
          originalShipPromise: "Ships by March 18",
          revisedShipDate: "2026-03-21",
          internalNote: "Carrier advisory affects this batch."
        })
      })
    );
    const payload = (await response.json()) as { delay?: { status: string; customer_path: string; reason_key: string } };

    expect(response.status).toBe(200);
    expect(payload.delay).toMatchObject({
      status: "awaiting_customer_response",
      customer_path: "request_delay_approval",
      reason_key: "carrier_disruption"
    });
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
    expect(sendOrderShippingDelayNotificationMock).toHaveBeenCalledTimes(1);
  });

  test("updates delay status to resolved", async () => {
    serverFromMock.mockImplementation((table: string) => {
      if (table === "order_shipping_delays") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "delay-1",
                    order_id: ORDER_ID,
                    store_id: "store-1",
                    status: "awaiting_customer_response"
                  },
                  error: null
                }))
              }))
            }))
          })),
          update: vi.fn((payload: Record<string, unknown>) => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: {
                      id: "delay-1",
                      order_id: ORDER_ID,
                      store_id: "store-1",
                      created_by_user_id: "user-1",
                      resolved_by_user_id: payload.resolved_by_user_id,
                      status: payload.status,
                      reason_key: "carrier_disruption",
                      customer_path: "request_delay_approval",
                      original_ship_promise: "Ships by March 18",
                      revised_ship_date: "2026-03-21",
                      internal_note: "Carrier advisory affects this batch.",
                      resolution_note: payload.resolution_note,
                      metadata_json: {},
                      resolved_at: payload.resolved_at,
                      created_at: "2026-03-13T22:30:00.000Z",
                      updated_at: "2026-03-13T22:40:00.000Z"
                    },
                    error: null
                  }))
                }))
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/orders/shipping-delays/[delayId]/route");
    const response = await route.PATCH(
      new NextRequest("http://localhost:3000/api/orders/shipping-delays/delay-1", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          action: "resolve",
          resolutionNote: "Customer approved the revised ship timing."
        })
      }),
      { params: Promise.resolve({ delayId: "11111111-1111-4111-8111-111111111111" }) }
    );
    const payload = (await response.json()) as { delay?: { status: string; resolution_note: string | null } };

    expect(response.status).toBe(200);
    expect(payload.delay).toMatchObject({
      status: "resolved",
      resolution_note: "Customer approved the revised ship timing."
    });
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
  });
});
