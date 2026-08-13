import { describe, expect, test, vi } from "vitest";
import {
  claimRefundForProcessing,
  listDigitalAccessReconciliationIssues,
  syncDisputeDigitalAccess,
  syncRefundDigitalAccess,
} from "@/lib/digital-products/access-state";

describe("digital financial access state", () => {
  test("claims a refund through the locking service-role RPC", async () => {
    const record = {
      id: "a1000000-0000-4000-8000-000000000001",
      order_id: "a2000000-0000-4000-8000-000000000001",
      store_id: "a3000000-0000-4000-8000-000000000001",
      requested_by_user_id: null,
      processed_by_user_id: "a4000000-0000-4000-8000-000000000001",
      amount_cents: 400,
      reason_key: "customer_request",
      reason_note: null,
      customer_message: null,
      status: "processing",
      stripe_refund_id: null,
      metadata_json: {},
      processed_at: null,
      source_event_id: null,
      source_event_created_at: null,
      created_at: "2026-08-13T17:00:00.000Z",
      updated_at: "2026-08-13T18:00:00.000Z",
    };
    const rpc = vi.fn(async () => ({
      data: { claimed: true, record },
      error: null,
    }));

    await expect(
      claimRefundForProcessing({
        refundId: record.id,
        storeId: record.store_id,
        processedByUserId: record.processed_by_user_id,
        client: { rpc },
      }),
    ).resolves.toMatchObject({ claimed: true, record: { status: "processing" } });
    expect(rpc).toHaveBeenCalledWith("claim_refund_for_processing", {
      p_refund_id: record.id,
      p_store_id: record.store_id,
      p_processed_by_user_id: record.processed_by_user_id,
    });
  });

  test("sends a refund transition to the transactional service-role RPC", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        applied: true,
        state_changed: true,
        access_changed: false,
        effective_access_state: "active",
        record: {
          id: "a1000000-0000-4000-8000-000000000001",
          order_id: "a2000000-0000-4000-8000-000000000001",
          store_id: "a3000000-0000-4000-8000-000000000001",
          requested_by_user_id: null,
          processed_by_user_id: null,
          amount_cents: 400,
          reason_key: "customer_request",
          reason_note: null,
          customer_message: null,
          status: "succeeded",
          stripe_refund_id: "re_123",
          metadata_json: {},
          processed_at: "2026-08-13T18:00:00.000Z",
          source_event_id: "evt_refund_123",
          source_event_created_at: "2026-08-13T18:00:00.000Z",
          created_at: "2026-08-13T17:00:00.000Z",
          updated_at: "2026-08-13T18:00:00.000Z",
        },
      },
      error: null,
    }));

    const result = await syncRefundDigitalAccess({
      refundRequestId: "a1000000-0000-4000-8000-000000000001",
      stripeRefundId: "re_123",
      status: "succeeded",
      stripeStatus: "succeeded",
      stripeFailureReason: null,
      pendingReason: null,
      processedByUserId: null,
      sourceEventId: "evt_refund_123",
      sourceEventCreatedAt: "2026-08-13T18:00:00.000Z",
      client: { rpc },
    });

    expect(result).toMatchObject({
      applied: true,
      stateChanged: true,
      accessChanged: false,
      effectiveAccessState: "active",
      record: { id: "a1000000-0000-4000-8000-000000000001" },
    });
    expect(rpc).toHaveBeenCalledWith("sync_refund_digital_access", {
      p_refund_request_id: "a1000000-0000-4000-8000-000000000001",
      p_stripe_refund_id: "re_123",
      p_incoming_status: "succeeded",
      p_stripe_status: "succeeded",
      p_stripe_failure_reason: null,
      p_pending_reason: null,
      p_processed_by_user_id: null,
      p_source_event_id: "evt_refund_123",
      p_source_event_created_at: "2026-08-13T18:00:00.000Z",
    });
  });

  test("never swallows a dispute transaction failure", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: "Injected entitlement transition failure" },
    }));

    await expect(
      syncDisputeDigitalAccess({
        orderId: "a2000000-0000-4000-8000-000000000001",
        storeId: "a3000000-0000-4000-8000-000000000001",
        stripeDisputeId: "dp_123",
        stripeChargeId: "ch_123",
        stripePaymentIntentId: "pi_123",
        amountCents: 1200,
        currency: "usd",
        reason: "fraudulent",
        status: "needs_response",
        isChargeRefundable: true,
        responseDueBy: null,
        metadata: {},
        sourceEventId: "evt_dispute_123",
        sourceEventCreatedAt: "2026-08-13T18:00:00.000Z",
        client: { rpc },
      }),
    ).rejects.toThrow("Injected entitlement transition failure");
  });

  test("returns only the bounded PII-free reconciliation contract", async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          issue_type: "full_refund_active_access",
          order_id: "a2000000-0000-4000-8000-000000000001",
          store_id: "a3000000-0000-4000-8000-000000000001",
          entitlement_count: 2,
          token_count: 1,
        },
      ],
      error: null,
    }));

    await expect(
      listDigitalAccessReconciliationIssues({ limit: 50, client: { rpc } }),
    ).resolves.toEqual([
      {
        issueType: "full_refund_active_access",
        orderId: "a2000000-0000-4000-8000-000000000001",
        storeId: "a3000000-0000-4000-8000-000000000001",
        entitlementCount: 2,
        tokenCount: 1,
      },
    ]);
    expect(rpc).toHaveBeenCalledWith("find_digital_access_reconciliation_issues", {
      p_limit: 50,
    });

    rpc.mockResolvedValueOnce({
      data: [
        {
          issue_type: "token_access_mismatch",
          order_id: "a2000000-0000-4000-8000-000000000001",
          store_id: "a3000000-0000-4000-8000-000000000001",
          entitlement_count: 1,
          token_count: 1,
          token_hash: "secret",
        },
      ],
      error: null,
    } as never);
    await expect(
      listDigitalAccessReconciliationIssues({ client: { rpc } }),
    ).rejects.toThrow("invalid result");
  });
});
