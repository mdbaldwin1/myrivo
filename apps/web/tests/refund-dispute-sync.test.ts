import { beforeEach, describe, expect, test, vi } from "vitest";

const adminFromMock = vi.fn();
const logAuditEventMock = vi.fn();
const sendOrderRefundNotificationMock = vi.fn();
const sendOrderDisputeNotificationMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args)
  }))
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: (...args: unknown[]) => logAuditEventMock(...args)
}));

vi.mock("@/lib/notifications/order-emails", () => ({
  sendOrderRefundNotification: (...args: unknown[]) => sendOrderRefundNotificationMock(...args),
  sendOrderDisputeNotification: (...args: unknown[]) => sendOrderDisputeNotificationMock(...args)
}));

describe("refund/dispute sync", () => {
  beforeEach(() => {
    vi.resetModules();
    adminFromMock.mockReset();
    logAuditEventMock.mockReset();
    sendOrderRefundNotificationMock.mockReset();
    sendOrderDisputeNotificationMock.mockReset();
  });

  test("syncStripeRefundRecord updates the local refund record and logs a success transition", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "order_refunds") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((column: string, value: string) => {
              if (column === "id" && value === "refund-request-1") {
                return {
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: "refund-request-1",
                      order_id: "order-1",
                      store_id: "store-1",
                      status: "processing",
                      metadata_json: {}
                    },
                    error: null
                  }))
                };
              }

              return {
                maybeSingle: vi.fn(async () => ({
                  data: null,
                  error: null
                }))
              };
            })
          })),
          update: vi.fn((payload: Record<string, unknown>) => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    id: "refund-request-1",
                    order_id: "order-1",
                    store_id: "store-1",
                    requested_by_user_id: "user-1",
                    processed_by_user_id: "user-2",
                    amount_cents: 1200,
                    reason_key: "customer_request",
                    reason_note: null,
                    customer_message: null,
                    status: payload.status,
                    stripe_refund_id: "re_123",
                    metadata_json: payload.metadata_json,
                    processed_at: payload.processed_at,
                    created_at: "2026-03-13T13:00:00.000Z",
                    updated_at: "2026-03-13T14:00:00.000Z"
                  },
                  error: null
                }))
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { syncStripeRefundRecord } = await import("@/lib/orders/refund-dispute-sync");
    const result = await syncStripeRefundRecord(
      {
        id: "re_123",
        object: "refund",
        amount: 1200,
        balance_transaction: null,
        charge: "ch_123",
        created: 1_741_878_400,
        currency: "usd",
        metadata: { refund_request_id: "refund-request-1" },
        payment_intent: "pi_123",
        reason: "requested_by_customer",
        receipt_number: null,
        source_transfer_reversal: null,
        status: "succeeded",
        transfer_reversal: null
      } as never,
      { processedByUserId: "user-2" }
    );

    expect(result.refund?.status).toBe("succeeded");
    expect(result.orderId).toBe("order-1");
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "refund_succeeded",
        entityId: "order-1"
      })
    );
    expect(sendOrderRefundNotificationMock).toHaveBeenCalledWith(
      "order-1",
      expect.objectContaining({
        refundId: "refund-request-1",
        amountCents: 1200
      })
    );
  });

  test("syncStripeDisputeRecord upserts the dispute and logs when a dispute opens", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: "order-1", store_id: "store-1" },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "order_disputes") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: null,
                error: null
              }))
            }))
          })),
          upsert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: "dispute-1",
                  order_id: "order-1",
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
                  metadata_json: {
                    networkReasonCode: null,
                    evidenceSubmissionCount: 0,
                    hasEvidence: false,
                    pastDue: false
                  },
                  closed_at: null,
                  created_at: "2026-03-13T14:00:00.000Z",
                  updated_at: "2026-03-13T14:00:00.000Z"
                },
                error: null
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { syncStripeDisputeRecord } = await import("@/lib/orders/refund-dispute-sync");
    const result = await syncStripeDisputeRecord(
      {
        id: "dp_123",
        object: "dispute",
        amount: 1200,
        charge: "ch_123",
        created: 1_741_878_400,
        currency: "usd",
        evidence: {},
        evidence_details: {
          due_by: 1_742_483_200,
          has_evidence: false,
          past_due: false,
          submission_count: 0
        },
        is_charge_refundable: true,
        payment_intent: "pi_123",
        reason: "fraudulent",
        status: "needs_response"
      } as never
    );

    expect(result?.status).toBe("needs_response");
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "dispute_opened",
        entityId: "order-1"
      })
    );
    expect(sendOrderDisputeNotificationMock).toHaveBeenCalledWith(
      "order-1",
      expect.objectContaining({
        disputeId: "dispute-1",
        status: "needs_response"
      })
    );
  });
});
