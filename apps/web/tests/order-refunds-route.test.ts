import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const authGetUserMock = vi.fn();
const getOwnedStoreBundleMock = vi.fn();
const enforceTrustedOriginMock = vi.fn();
const logAuditEventMock = vi.fn();
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

vi.mock("@/lib/security/request-origin", () => ({
  enforceTrustedOrigin: (...args: unknown[]) => enforceTrustedOriginMock(...args)
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: (...args: unknown[]) => logAuditEventMock(...args)
}));

const ORDER_ID = "99999999-9999-4999-8999-999999999999";

beforeEach(() => {
  vi.resetModules();
  authGetUserMock.mockReset();
  getOwnedStoreBundleMock.mockReset();
  enforceTrustedOriginMock.mockReset();
  logAuditEventMock.mockReset();
  serverFromMock.mockReset();
  adminFromMock.mockReset();

  authGetUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  getOwnedStoreBundleMock.mockResolvedValue({ store: { id: "store-1", slug: "at-home-apothecary" } });
  enforceTrustedOriginMock.mockReturnValue(null);
});

describe("order refunds route", () => {
  test("creates a full refund request for the remaining refundable amount", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: ORDER_ID,
                    store_id: "store-1",
                    status: "paid",
                    total_cents: 3000,
                    customer_email: "buyer@example.com"
                  },
                  error: null
                }))
              }))
            }))
          }))
        };
      }

      if (table === "order_refunds") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                returns: vi.fn(async () => ({
                  data: [{ amount_cents: 500, status: "requested" }],
                  error: null
                }))
              }))
            }))
          })),
          insert: vi.fn((payload: Record<string, unknown>) => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: "refund-1",
                  order_id: ORDER_ID,
                  store_id: "store-1",
                  requested_by_user_id: "user-1",
                  processed_by_user_id: null,
                  amount_cents: payload.amount_cents,
                  reason_key: payload.reason_key,
                  reason_note: payload.reason_note,
                  customer_message: payload.customer_message,
                  status: "requested",
                  stripe_refund_id: null,
                  metadata_json: payload.metadata_json,
                  processed_at: null,
                  created_at: "2026-03-13T12:00:00.000Z",
                  updated_at: "2026-03-13T12:00:00.000Z"
                },
                error: null
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/orders/refunds/route");
    const response = await route.POST(
      new NextRequest("http://localhost:3000/api/orders/refunds", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          orderId: ORDER_ID,
          mode: "full",
          reasonKey: "customer_request",
          customerMessage: "We’re refunding the remaining balance."
        })
      })
    );
    const payload = (await response.json()) as { refund?: { amount_cents: number }; remainingRefundableCents?: number };

    expect(response.status).toBe(200);
    expect(payload.refund?.amount_cents).toBe(2500);
    expect(payload.remainingRefundableCents).toBe(0);
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
  });

  test("rejects partial refunds above the remaining refundable amount", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: ORDER_ID,
                    store_id: "store-1",
                    status: "paid",
                    total_cents: 3000,
                    customer_email: "buyer@example.com"
                  },
                  error: null
                }))
              }))
            }))
          }))
        };
      }

      if (table === "order_refunds") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                returns: vi.fn(async () => ({
                  data: [{ amount_cents: 2000, status: "requested" }],
                  error: null
                }))
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const route = await import("@/app/api/orders/refunds/route");
    const response = await route.POST(
      new NextRequest("http://localhost:3000/api/orders/refunds", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({
          orderId: ORDER_ID,
          mode: "partial",
          amountCents: 1500,
          reasonKey: "damaged_item"
        })
      })
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/remains refundable/i);
    expect(logAuditEventMock).not.toHaveBeenCalled();
  });
});
