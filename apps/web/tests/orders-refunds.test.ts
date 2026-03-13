import { describe, expect, test } from "vitest";
import {
  DISPUTE_STATUSES,
  MERCHANT_REFUND_REASONS,
  ORDER_FINANCIAL_STATUSES,
  REFUND_RECORD_STATUSES,
  STRIPE_REFUND_REASON_MAP,
  getCommittedRefundTotalCents,
  getRemainingRefundableCents,
  getDisputeStatusLabel,
  getRefundReasonLabel,
  getRefundStatusLabel,
  getRefundUxContract,
  mapStripeDisputeStatus,
  mapStripeRefundStatus
} from "@/lib/orders/refunds";

describe("refunds contract", () => {
  test("defines the intended financial status model", () => {
    expect(ORDER_FINANCIAL_STATUSES).toEqual(["pending", "paid", "failed", "cancelled", "partially_refunded", "refunded"]);
  });

  test("maps refund reasons to stable labels and Stripe reasons", () => {
    expect(MERCHANT_REFUND_REASONS).toContain("customer_request");
    expect(getRefundReasonLabel("shipping_failure")).toBe("Shipping failure");
    expect(STRIPE_REFUND_REASON_MAP.customer_request).toBe("requested_by_customer");
    expect(STRIPE_REFUND_REASON_MAP.duplicate).toBe("duplicate");
    expect(STRIPE_REFUND_REASON_MAP.fraud_suspected).toBe("fraudulent");
  });

  test("defines refund and dispute status labels", () => {
    expect(REFUND_RECORD_STATUSES).toContain("succeeded");
    expect(getRefundStatusLabel("succeeded")).toBe("Refunded");
    expect(mapStripeRefundStatus("requires_action")).toBe("processing");
    expect(DISPUTE_STATUSES).toContain("needs_response");
    expect(getDisputeStatusLabel("needs_response")).toBe("Response needed");
    expect(DISPUTE_STATUSES).toContain("prevented");
    expect(mapStripeDisputeStatus("warning_closed")).toBe("warning_closed");
  });

  test("captures the refund UX contract for follow-on beads", () => {
    const contract = getRefundUxContract();
    expect(contract.merchantSurface).toBe("Order detail flyout");
    expect(contract.requiredInputs).toContain("refund reason");
    expect(contract.timelineEvents).toContain("dispute_opened");
    expect(contract.customerComms).toMatch(/customer-facing messaging/i);
  });

  test("calculates committed and remaining refund totals", () => {
    const refunds = [
      { amount_cents: 500, status: "requested" as const },
      { amount_cents: 700, status: "succeeded" as const },
      { amount_cents: 300, status: "failed" as const }
    ];

    expect(getCommittedRefundTotalCents(refunds)).toBe(1200);
    expect(getRemainingRefundableCents(3000, refunds)).toBe(1800);
  });
});
