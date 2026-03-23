import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const authGetUserMock = vi.fn();
const serverFromMock = vi.fn();
const adminFromMock = vi.fn();
const logAuditEventMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: (...args: unknown[]) => authGetUserMock(...args) },
    from: (...args: unknown[]) => serverFromMock(...args)
  }))
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: (...args: unknown[]) => logAuditEventMock(...args)
}));

const ORDER_ID = "99999999-9999-4999-8999-999999999999";

beforeEach(() => {
  vi.resetModules();
  authGetUserMock.mockReset();
  serverFromMock.mockReset();
  adminFromMock.mockReset();
  logAuditEventMock.mockReset();

  authGetUserMock.mockResolvedValue({
    data: {
      user: {
        id: "customer-1",
        email: "buyer@example.com"
      }
    }
  });
});

describe("customer shipping delay response route", () => {
  test("marks the delay approved when the customer accepts the revised timing", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              ilike: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: ORDER_ID,
                    store_id: "store-1",
                    customer_email: "buyer@example.com",
                    fulfillment_method: "shipping",
                    fulfillment_status: "pending_fulfillment"
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
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  in: vi.fn(() => ({
                    order: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({
                        data: {
                          id: "delay-1",
                          order_id: ORDER_ID,
                          store_id: "store-1",
                          created_by_user_id: "owner-1",
                          resolved_by_user_id: null,
                          status: "awaiting_customer_response",
                          reason_key: "carrier_disruption",
                          customer_path: "request_delay_approval",
                          original_ship_promise: "Ships by March 18",
                          revised_ship_date: "2026-03-21",
                          internal_note: "Carrier issue.",
                          resolution_note: null,
                          metadata_json: {},
                          resolved_at: null,
                          created_at: "2026-03-13T12:50:00.000Z",
                          updated_at: "2026-03-13T12:50:00.000Z"
                        },
                        error: null
                      }))
                    }))
                  }))
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
                      created_by_user_id: "owner-1",
                      resolved_by_user_id: null,
                      status: payload.status,
                      reason_key: "carrier_disruption",
                      customer_path: "request_delay_approval",
                      original_ship_promise: "Ships by March 18",
                      revised_ship_date: "2026-03-21",
                      internal_note: "Carrier issue.",
                      resolution_note: null,
                      metadata_json: payload.metadata_json,
                      resolved_at: null,
                      created_at: "2026-03-13T12:50:00.000Z",
                      updated_at: "2026-03-13T12:55:00.000Z"
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

    const route = await import("@/app/api/customer/orders/[orderId]/shipping-delay-response/route");
    const response = await route.POST(
      new NextRequest(`http://localhost:3000/api/customer/orders/${ORDER_ID}/shipping-delay-response`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ action: "approve_delay" })
      }),
      { params: Promise.resolve({ orderId: ORDER_ID }) }
    );
    const payload = (await response.json()) as { delay?: { status: string; metadata_json: { customerResponse?: { action: string } } } };

    expect(response.status).toBe(200);
    expect(payload.delay?.status).toBe("delay_approved");
    expect(payload.delay?.metadata_json.customerResponse?.action).toBe("approve_delay");
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
  });
});
