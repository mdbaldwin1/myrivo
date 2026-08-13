import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const authGetUserMock = vi.fn();
const getOwnedStoreBundleMock = vi.fn();
const enforceTrustedOriginMock = vi.fn();
const logAuditEventMock = vi.fn();
const serverFromMock = vi.fn();
const adminFromMock = vi.fn();
const isStripeStubModeMock = vi.fn();
const sendOrderRefundNotificationMock = vi.fn();
const syncStripeRefundRecordMock = vi.fn();
const getStripeClientMock = vi.fn();

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

vi.mock("@/lib/orders/refund-dispute-sync", () => ({
  syncStripeRefundRecord: (...args: unknown[]) => syncStripeRefundRecordMock(...args)
}));

vi.mock("@/lib/stripe/server", () => ({
  getStripeClient: (...args: unknown[]) => getStripeClientMock(...args)
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

vi.mock("@/lib/env", () => ({
  isStripeStubMode: (...args: unknown[]) => isStripeStubModeMock(...args)
}));

vi.mock("@/lib/notifications/order-emails", () => ({
  sendOrderRefundNotification: (...args: unknown[]) => sendOrderRefundNotificationMock(...args)
}));

describe("order refund execution route", () => {
  beforeEach(() => {
    vi.resetModules();
    authGetUserMock.mockReset();
    getOwnedStoreBundleMock.mockReset();
    enforceTrustedOriginMock.mockReset();
    logAuditEventMock.mockReset();
    serverFromMock.mockReset();
    adminFromMock.mockReset();
    isStripeStubModeMock.mockReset();
    sendOrderRefundNotificationMock.mockReset();
    syncStripeRefundRecordMock.mockReset();
    getStripeClientMock.mockReset();

    authGetUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getOwnedStoreBundleMock.mockResolvedValue({ store: { id: "store-1", slug: "at-home-apothecary" } });
    enforceTrustedOriginMock.mockReturnValue(null);
    isStripeStubModeMock.mockReturnValue(true);
  });

  test("processes a requested refund in stub mode and marks it succeeded", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "order_refunds") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "refund-1",
                    order_id: "order-1",
                    store_id: "store-1",
                    amount_cents: 1200,
                    reason_key: "customer_request",
                    status: "requested",
                    stripe_refund_id: null,
                    metadata_json: {},
                    orders: {
                      id: "order-1",
                      status: "paid",
                      stripe_payment_intent_id: "pi_123"
                    }
                  },
                  error: null
                }))
              }))
            }))
          })),
          update: vi.fn((payload: Record<string, unknown>) => ({
            eq: vi.fn(() => {
              if (payload.status !== "processing") {
                throw new Error(`Unexpected direct refund transition ${String(payload.status)}`);
              }
              return Promise.resolve({ data: null, error: null });
            })
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
    syncStripeRefundRecordMock.mockResolvedValue({
      refund: {
        id: "refund-1",
        order_id: "order-1",
        store_id: "store-1",
        requested_by_user_id: "user-1",
        processed_by_user_id: "user-1",
        amount_cents: 1200,
        reason_key: "customer_request",
        reason_note: null,
        customer_message: null,
        status: "succeeded",
        stripe_refund_id: "stub_refund_refund-1",
        metadata_json: { processedMode: "stub" },
        processed_at: "2026-03-13T14:00:00.000Z",
        created_at: "2026-03-13T13:00:00.000Z",
        updated_at: "2026-03-13T14:00:00.000Z"
      },
      orderId: "order-1"
    });

    const route = await import("@/app/api/orders/refunds/[refundId]/route");
    const response = await route.PATCH(
      new NextRequest("http://localhost:3000/api/orders/refunds/refund-1", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({ action: "process" })
      }),
      { params: Promise.resolve({ refundId: "11111111-1111-4111-8111-111111111111" }) }
    );
    const payload = (await response.json()) as { refund?: { status: string; metadata_json: Record<string, unknown> } };

    expect(response.status).toBe(200);
    expect(payload.refund?.status).toBe("succeeded");
    expect(payload.refund?.metadata_json).toMatchObject({ processedMode: "stub" });
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
    expect(syncStripeRefundRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "stub_refund_refund-1",
        status: "succeeded"
      }),
      expect.objectContaining({
        refundRequestId: "refund-1",
        processedByUserId: "user-1",
        sourceEventId: "stub_refund:refund-1:succeeded"
      })
    );
  });

  test("uses stub refund execution for stub payment intents even when env stub mode is off", async () => {
    isStripeStubModeMock.mockReturnValue(false);

    adminFromMock.mockImplementation((table: string) => {
      if (table === "order_refunds") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "refund-2",
                    order_id: "order-2",
                    store_id: "store-1",
                    amount_cents: 2800,
                    reason_key: "customer_request",
                    status: "requested",
                    stripe_refund_id: null,
                    metadata_json: {},
                    orders: {
                      id: "order-2",
                      status: "paid",
                      stripe_payment_intent_id: "stub_pi_123"
                    }
                  },
                  error: null
                }))
              }))
            }))
          })),
          update: vi.fn((payload: Record<string, unknown>) => ({
            eq: vi.fn(() => {
              if (payload.status !== "processing") {
                throw new Error(`Unexpected direct refund transition ${String(payload.status)}`);
              }
              return Promise.resolve({ data: null, error: null });
            })
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
    syncStripeRefundRecordMock.mockResolvedValue({
      refund: {
        id: "refund-2",
        order_id: "order-2",
        store_id: "store-1",
        requested_by_user_id: "user-1",
        processed_by_user_id: "user-1",
        amount_cents: 2800,
        reason_key: "customer_request",
        reason_note: null,
        customer_message: null,
        status: "succeeded",
        stripe_refund_id: "stub_refund_refund-2",
        metadata_json: { processedMode: "stub" },
        processed_at: "2026-03-13T14:00:00.000Z",
        created_at: "2026-03-13T13:00:00.000Z",
        updated_at: "2026-03-13T14:00:00.000Z"
      },
      orderId: "order-2"
    });

    const route = await import("@/app/api/orders/refunds/[refundId]/route");
    const response = await route.PATCH(
      new NextRequest("http://localhost:3000/api/orders/refunds/refund-2", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({ action: "process" })
      }),
      { params: Promise.resolve({ refundId: "22222222-2222-4222-8222-222222222222" }) }
    );
    const payload = (await response.json()) as { refund?: { status: string; metadata_json: Record<string, unknown> } };

    expect(response.status).toBe(200);
    expect(payload.refund?.status).toBe("succeeded");
    expect(payload.refund?.metadata_json).toMatchObject({ processedMode: "stub" });
    expect(syncStripeRefundRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "stub_refund_refund-2" }),
      expect.objectContaining({ refundRequestId: "refund-2" })
    );
  });

  test("does not mark a provider refund failed when access synchronization fails", async () => {
    isStripeStubModeMock.mockReturnValue(false);
    const updateStatuses: unknown[] = [];
    adminFromMock.mockImplementation((table: string) => {
      if (table !== "order_refunds") throw new Error(`Unexpected table ${table}`);
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: "refund-3",
                  order_id: "order-3",
                  store_id: "store-1",
                  amount_cents: 3400,
                  reason_key: "customer_request",
                  status: "requested",
                  stripe_refund_id: null,
                  metadata_json: {},
                  orders: {
                    id: "order-3",
                    status: "paid",
                    stripe_payment_intent_id: "pi_live_123"
                  }
                },
                error: null
              }))
            }))
          }))
        })),
        update: vi.fn((payload: Record<string, unknown>) => ({
          eq: vi.fn(async () => {
            updateStatuses.push(payload.status);
            return { data: null, error: null };
          })
        }))
      };
    });
    getStripeClientMock.mockReturnValue({
      refunds: {
        create: vi.fn(async () => ({
          id: "re_123",
          status: "succeeded",
          created: 1_786_637_400,
          metadata: { refund_request_id: "refund-3" }
        }))
      }
    });
    syncStripeRefundRecordMock.mockRejectedValue(new Error("transaction unavailable"));

    const route = await import("@/app/api/orders/refunds/[refundId]/route");
    const response = await route.PATCH(
      new NextRequest("http://localhost:3000/api/orders/refunds/refund-3", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000"
        },
        body: JSON.stringify({ action: "process" })
      }),
      { params: Promise.resolve({ refundId: "33333333-3333-4333-8333-333333333333" }) }
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: "transaction unavailable" });
    expect(updateStatuses).toEqual(["processing"]);
  });
});
