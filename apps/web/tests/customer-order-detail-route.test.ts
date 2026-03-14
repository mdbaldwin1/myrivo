import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const authGetUserMock = vi.fn();
const serverFromMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: (...args: unknown[]) => authGetUserMock(...args) },
    from: (...args: unknown[]) => serverFromMock(...args)
  }))
}));

const ORDER_ID = "99999999-9999-4999-8999-999999999999";

beforeEach(() => {
  vi.resetModules();
  authGetUserMock.mockReset();
  serverFromMock.mockReset();

  authGetUserMock.mockResolvedValue({
    data: {
      user: {
        id: "customer-1",
        email: "buyer@example.com"
      }
    }
  });
});

describe("customer order detail route", () => {
  test("returns active shipping delay history for the authenticated customer", async () => {
    serverFromMock.mockImplementation((table: string) => {
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
                    customer_first_name: "Taylor",
                    customer_last_name: "Buyer",
                    customer_note: null,
                    fulfillment_method: "shipping",
                    fulfillment_label: "Shipping",
                    pickup_location_snapshot_json: null,
                    pickup_window_start_at: null,
                    pickup_window_end_at: null,
                    pickup_timezone: null,
                    status: "paid",
                    fulfillment_status: "pending_fulfillment",
                    created_at: "2026-03-13T12:00:00.000Z",
                    fulfilled_at: null,
                    shipped_at: null,
                    delivered_at: null,
                    subtotal_cents: 2800,
                    shipping_fee_cents: 0,
                    discount_cents: 0,
                    total_cents: 2800,
                    currency: "usd",
                    carrier: null,
                    tracking_number: null,
                    tracking_url: null,
                    shipment_status: null,
                    stores: {
                      id: "store-1",
                      name: "At Home Apothecary",
                      slug: "at-home-apothecary"
                    }
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
              order: vi.fn(() => ({
                returns: vi.fn(() =>
                  Promise.resolve({
                    data: [],
                    error: null
                  })
                )
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
                order: vi.fn(() => ({
                  returns: vi.fn(() =>
                    Promise.resolve({
                      data: [
                        {
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
                        }
                      ],
                      error: null
                    })
                  )
                }))
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/customer/orders/[orderId]/route");
    const response = await route.GET(new NextRequest(`http://localhost:3000/api/customer/orders/${ORDER_ID}`), {
      params: Promise.resolve({ orderId: ORDER_ID })
    });
    const payload = (await response.json()) as {
      shippingDelays?: Array<{ id: string; status: string; customer_path: string }>;
    };

    expect(response.status).toBe(200);
    expect(payload.shippingDelays).toHaveLength(1);
    expect(payload.shippingDelays?.[0]).toMatchObject({
      id: "delay-1",
      status: "awaiting_customer_response",
      customer_path: "request_delay_approval"
    });
  });
});
