import { beforeEach, describe, expect, test, vi } from "vitest";

const authGetUserMock = vi.fn();
const serverFromMock = vi.fn();
const getOwnedStoreBundleMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: (...args: unknown[]) => authGetUserMock(...args) },
    from: (...args: unknown[]) => serverFromMock(...args)
  }))
}));

vi.mock("@/lib/stores/owner-store", () => ({
  getOwnedStoreBundle: (...args: unknown[]) => getOwnedStoreBundleMock(...args)
}));

beforeEach(() => {
  vi.resetModules();
  authGetUserMock.mockReset();
  serverFromMock.mockReset();
  getOwnedStoreBundleMock.mockReset();

  authGetUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  getOwnedStoreBundleMock.mockResolvedValue({
    store: { id: "store-1", slug: "curby" }
  });
});

describe("orders export route", () => {
  test("includes fee reporting columns in csv output", async () => {
    serverFromMock.mockImplementation((table: string) => {
      if (table !== "orders") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(async () => ({
              data: [
                {
                  id: "order-1",
                  created_at: "2026-03-01T12:00:00.000Z",
                  customer_email: "buyer@example.com",
                  currency: "usd",
                  subtotal_cents: 5000,
                  discount_cents: 0,
                  total_cents: 5000,
                  status: "paid",
                  fulfillment_status: "pending_fulfillment",
                  promo_code: null,
                  carrier: null,
                  tracking_number: null,
                  tracking_url: null,
                  shipment_status: null,
                  order_fee_breakdowns: {
                    platform_fee_cents: 175,
                    net_payout_cents: 4825,
                    fee_bps: 350,
                    fee_fixed_cents: 0,
                    plan_key: "starter"
                  }
                }
              ],
              error: null
            }))
          }))
        }))
      };
    });

    const route = await import("@/app/api/orders/export/route");
    const response = await route.GET();
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(csv).toContain("platform_fee_cents,net_payout_cents,fee_bps,fee_fixed_cents,fee_plan_key");
    expect(csv).toContain("175,4825,350,0,starter");
  });
});
