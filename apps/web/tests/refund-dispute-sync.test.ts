import { beforeEach, describe, expect, test, vi } from "vitest";

const adminFromMock = vi.fn();
const adminRpcMock = vi.fn();
const sendOrderRefundNotificationMock = vi.fn();
const sendOrderDisputeNotificationMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => adminFromMock(...args),
    rpc: (...args: unknown[]) => adminRpcMock(...args),
  })),
}));

vi.mock("@/lib/notifications/order-emails", () => ({
  sendOrderRefundNotification: (...args: unknown[]) =>
    sendOrderRefundNotificationMock(...args),
  sendOrderDisputeNotification: (...args: unknown[]) =>
    sendOrderDisputeNotificationMock(...args),
}));

const ids = {
  refund: "a1000000-0000-4000-8000-000000000001",
  dispute: "a2000000-0000-4000-8000-000000000001",
  order: "a3000000-0000-4000-8000-000000000001",
  store: "a4000000-0000-4000-8000-000000000001",
} as const;

function refundRecord(status = "succeeded") {
  return {
    id: ids.refund,
    order_id: ids.order,
    store_id: ids.store,
    requested_by_user_id: null,
    processed_by_user_id: null,
    amount_cents: 1200,
    reason_key: "customer_request",
    reason_note: null,
    customer_message: null,
    status,
    stripe_refund_id: "re_123",
    metadata_json: {},
    processed_at: "2026-08-13T18:00:00.000Z",
    source_event_id: "evt_refund_123",
    source_event_created_at: "2026-08-13T18:00:00.000Z",
    created_at: "2026-08-13T17:00:00.000Z",
    updated_at: "2026-08-13T18:00:00.000Z",
  };
}

function disputeRecord(status = "needs_response") {
  return {
    id: ids.dispute,
    order_id: ids.order,
    store_id: ids.store,
    stripe_dispute_id: "dp_123",
    stripe_charge_id: "ch_123",
    stripe_payment_intent_id: "pi_123",
    amount_cents: 1200,
    currency: "usd",
    reason: "fraudulent",
    status,
    is_charge_refundable: true,
    response_due_by: "2026-08-20T18:00:00.000Z",
    metadata_json: {},
    closed_at: null,
    source_event_id: "evt_dispute_123",
    source_event_created_at: "2026-08-13T18:00:00.000Z",
    created_at: "2026-08-13T17:00:00.000Z",
    updated_at: "2026-08-13T18:00:00.000Z",
  };
}

function stripeRefund(status = "succeeded") {
  return {
    id: "re_123",
    object: "refund",
    amount: 1200,
    balance_transaction: null,
    charge: "ch_123",
    created: 1_765_649_600,
    currency: "usd",
    metadata: { refund_request_id: ids.refund },
    payment_intent: "pi_123",
    reason: "requested_by_customer",
    receipt_number: null,
    source_transfer_reversal: null,
    status,
    transfer_reversal: null,
  } as never;
}

function stripeDispute(status = "needs_response") {
  return {
    id: "dp_123",
    object: "dispute",
    amount: 1200,
    charge: "ch_123",
    created: 1_765_649_600,
    currency: "usd",
    evidence: {},
    evidence_details: {
      due_by: 1_766_254_400,
      has_evidence: false,
      past_due: false,
      submission_count: 0,
    },
    is_charge_refundable: true,
    payment_intent: "pi_123",
    reason: "fraudulent",
    status,
  } as never;
}

describe("refund/dispute sync", () => {
  beforeEach(() => {
    vi.resetModules();
    adminFromMock.mockReset();
    adminRpcMock.mockReset();
    sendOrderRefundNotificationMock.mockReset();
    sendOrderDisputeNotificationMock.mockReset();
  });

  test("uses the transactional refund RPC and notifies only after it commits", async () => {
    adminRpcMock.mockResolvedValue({
      data: {
        applied: true,
        state_changed: true,
        access_changed: true,
        effective_access_state: "revoked",
        record: refundRecord(),
      },
      error: null,
    });

    const { syncStripeRefundRecord } = await import(
      "@/lib/orders/refund-dispute-sync"
    );
    const result = await syncStripeRefundRecord(stripeRefund(), {
      sourceEventId: "evt_refund_123",
      sourceEventCreatedAt: "2026-08-13T18:00:00.000Z",
    });

    expect(result.refund?.status).toBe("succeeded");
    expect(adminRpcMock).toHaveBeenCalledWith(
      "sync_refund_digital_access",
      expect.objectContaining({
        p_refund_request_id: ids.refund,
        p_stripe_refund_id: "re_123",
        p_incoming_status: "succeeded",
        p_source_event_id: "evt_refund_123",
        p_source_event_created_at: "2026-08-13T18:00:00.000Z",
      }),
    );
    expect(sendOrderRefundNotificationMock).toHaveBeenCalledTimes(1);
  });

  test("propagates an access RPC failure so the webhook remains retryable", async () => {
    adminRpcMock.mockResolvedValue({
      data: null,
      error: { message: "Injected access audit failure" },
    });

    const { syncStripeRefundRecord } = await import(
      "@/lib/orders/refund-dispute-sync"
    );
    await expect(
      syncStripeRefundRecord(stripeRefund(), {
        sourceEventId: "evt_refund_failure",
        sourceEventCreatedAt: "2026-08-13T18:00:00.000Z",
      }),
    ).rejects.toThrow("Injected access audit failure");
    expect(sendOrderRefundNotificationMock).not.toHaveBeenCalled();
  });

  test("does not repeat notifications for duplicate or stale refund events", async () => {
    adminRpcMock.mockResolvedValue({
      data: {
        applied: false,
        state_changed: false,
        access_changed: false,
        effective_access_state: "revoked",
        record: refundRecord(),
      },
      error: null,
    });

    const { syncStripeRefundRecord } = await import(
      "@/lib/orders/refund-dispute-sync"
    );
    const result = await syncStripeRefundRecord(stripeRefund("pending"), {
      sourceEventId: "evt_refund_stale",
      sourceEventCreatedAt: "2026-08-13T17:00:00.000Z",
    });

    expect(result.refund?.status).toBe("succeeded");
    expect(sendOrderRefundNotificationMock).not.toHaveBeenCalled();
  });

  test("uses the transactional dispute RPC and preserves source ordering metadata", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table !== "orders") throw new Error(`Unexpected table ${table}`);
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: { id: ids.order, store_id: ids.store },
              error: null,
            })),
          })),
        })),
      };
    });
    adminRpcMock.mockResolvedValue({
      data: {
        applied: true,
        state_changed: true,
        access_changed: true,
        effective_access_state: "suspended",
        record: disputeRecord(),
      },
      error: null,
    });

    const { syncStripeDisputeRecord } = await import(
      "@/lib/orders/refund-dispute-sync"
    );
    const result = await syncStripeDisputeRecord(stripeDispute(), {
      sourceEventId: "evt_dispute_123",
      sourceEventCreatedAt: "2026-08-13T18:00:00.000Z",
    });

    expect(result?.status).toBe("needs_response");
    expect(adminRpcMock).toHaveBeenCalledWith(
      "sync_dispute_digital_access",
      expect.objectContaining({
        p_order_id: ids.order,
        p_stripe_dispute_id: "dp_123",
        p_incoming_status: "needs_response",
        p_source_event_id: "evt_dispute_123",
      }),
    );
    expect(sendOrderDisputeNotificationMock).toHaveBeenCalledTimes(1);
  });
});
