import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const authGetUserMock = vi.fn();
const getOwnedStoreBundleMock = vi.fn();
const serverFromMock = vi.fn();
const adminFromMock = vi.fn();

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

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundle: (...args: unknown[]) => getOwnedStoreBundleMock(...args)
}));

const ORDER_ID = "99999999-9999-4999-8999-999999999999";

beforeEach(() => {
  vi.resetModules();
  authGetUserMock.mockReset();
  getOwnedStoreBundleMock.mockReset();
  serverFromMock.mockReset();
  adminFromMock.mockReset();

  authGetUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  getOwnedStoreBundleMock.mockResolvedValue({ store: { id: "store-1", slug: "at-home-apothecary" } });
});

describe("order detail route", () => {
  test("returns refund history with the order payload", async () => {
    serverFromMock.mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: ORDER_ID,
                    customer_email: "buyer@example.com",
                    subtotal_cents: 3000,
                    total_cents: 3000,
                    status: "paid",
                    fulfillment_method: "shipping",
                    fulfillment_label: "Shipping",
                    fulfillment_status: "pending_fulfillment",
                    pickup_location_id: null,
                    pickup_location_snapshot_json: null,
                    pickup_window_start_at: null,
                    pickup_window_end_at: null,
                    pickup_timezone: null,
                    fulfilled_at: null,
                    shipped_at: null,
                    delivered_at: null,
                    discount_cents: 0,
                    promo_code: null,
                    currency: "usd",
                    carrier: null,
                    tracking_number: null,
                    tracking_url: null,
                    shipment_status: null,
                    last_tracking_sync_at: null,
                    created_at: "2026-03-13T12:00:00.000Z",
                    order_fee_breakdowns: null
                  },
                  error: null
                }))
              }))
            }))
          }))
        };
      }

      if (table === "order_items") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: [],
                error: null
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    adminFromMock.mockImplementation((table: string) => {
      if (table === "order_refunds") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  returns: vi.fn(async () => ({
                    data: [
                      {
                        id: "refund-1",
                        order_id: ORDER_ID,
                        store_id: "store-1",
                        requested_by_user_id: "user-1",
                        processed_by_user_id: null,
                        amount_cents: 1200,
                        reason_key: "customer_request",
                        reason_note: null,
                        customer_message: null,
                        status: "requested",
                        stripe_refund_id: null,
                        metadata_json: {},
                        processed_at: null,
                        created_at: "2026-03-13T12:30:00.000Z",
                        updated_at: "2026-03-13T12:30:00.000Z"
                      }
                    ],
                    error: null
                  }))
                }))
              }))
            }))
          }))
        };
      }

      if (table === "order_disputes") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  returns: vi.fn(async () => ({
                    data: [
                      {
                        id: "dispute-1",
                        order_id: ORDER_ID,
                        store_id: "store-1",
                        stripe_dispute_id: "dp_123",
                        stripe_charge_id: "ch_123",
                        stripe_payment_intent_id: "pi_123",
                        amount_cents: 1200,
                        currency: "usd",
                        reason: "fraudulent",
                        status: "needs_response",
                        is_charge_refundable: true,
                        response_due_by: "2026-03-20T12:00:00.000Z",
                        metadata_json: {},
                        closed_at: null,
                        created_at: "2026-03-13T12:45:00.000Z",
                        updated_at: "2026-03-13T12:45:00.000Z"
                      }
                    ],
                    error: null
                  }))
                }))
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected admin table ${table}`);
    });

    const route = await import("@/app/api/orders/[orderId]/route");
    const response = await route.GET(new NextRequest(`http://localhost:3000/api/orders/${ORDER_ID}`), {
      params: Promise.resolve({ orderId: ORDER_ID })
    });
    const payload = (await response.json()) as {
      refunds?: Array<{ id: string; amount_cents: number }>;
      disputes?: Array<{ id: string; status: string }>;
    };

    expect(response.status).toBe(200);
    expect(payload.refunds).toHaveLength(1);
    expect(payload.refunds?.[0]).toMatchObject({ id: "refund-1", amount_cents: 1200 });
    expect(payload.disputes).toHaveLength(1);
    expect(payload.disputes?.[0]).toMatchObject({ id: "dispute-1", status: "needs_response" });
  });
});
