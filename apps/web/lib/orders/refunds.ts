export const ORDER_FINANCIAL_STATUSES = [
  "pending",
  "paid",
  "failed",
  "cancelled",
  "partially_refunded",
  "refunded"
] as const;

export type OrderFinancialStatus = (typeof ORDER_FINANCIAL_STATUSES)[number];

export const MERCHANT_REFUND_REASONS = [
  "customer_request",
  "duplicate",
  "fraud_suspected",
  "damaged_item",
  "inventory_unavailable",
  "shipping_failure",
  "service_issue",
  "other"
] as const;

export type MerchantRefundReason = (typeof MERCHANT_REFUND_REASONS)[number];

export const STRIPE_REFUND_REASON_MAP: Record<MerchantRefundReason, "duplicate" | "fraudulent" | "requested_by_customer" | null> = {
  customer_request: "requested_by_customer",
  duplicate: "duplicate",
  fraud_suspected: "fraudulent",
  damaged_item: null,
  inventory_unavailable: null,
  shipping_failure: null,
  service_issue: null,
  other: null
};

export const REFUND_RECORD_STATUSES = ["requested", "processing", "succeeded", "failed", "cancelled"] as const;

export type RefundRecordStatus = (typeof REFUND_RECORD_STATUSES)[number];

export const REFUND_COMMITTED_STATUSES = ["requested", "processing", "succeeded"] as const;

export type RefundCommittedStatus = (typeof REFUND_COMMITTED_STATUSES)[number];

export const DISPUTE_STATUSES = [
  "warning_needs_response",
  "warning_under_review",
  "warning_closed",
  "needs_response",
  "under_review",
  "won",
  "lost",
  "prevented"
] as const;

export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const REFUND_POLICY_COPY_DEFAULTS = {
  intro:
    "Refunds should be handled from the order detail surface so the financial action, reason, customer communication, and audit trail stay in one place.",
  partialRefunds:
    "Partial refunds are supported for operational adjustments such as damaged items, shipping failures, or negotiated customer-service outcomes.",
  disputes:
    "Disputes are operational escalations. Staff should be able to see the current status, response deadline, and evidence requirements before taking action.",
  customerExpectation:
    "Customer-facing communication should go out automatically whenever money movement or a dispute outcome materially changes the order."
} as const;

export function getRefundReasonLabel(reason: MerchantRefundReason) {
  switch (reason) {
    case "customer_request":
      return "Customer request";
    case "duplicate":
      return "Duplicate charge";
    case "fraud_suspected":
      return "Fraud suspected";
    case "damaged_item":
      return "Damaged item";
    case "inventory_unavailable":
      return "Inventory unavailable";
    case "shipping_failure":
      return "Shipping failure";
    case "service_issue":
      return "Service issue";
    case "other":
      return "Other";
  }
}

export function getRefundStatusLabel(status: RefundRecordStatus) {
  switch (status) {
    case "requested":
      return "Requested";
    case "processing":
      return "Processing";
    case "succeeded":
      return "Refunded";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
  }
}

export function getDisputeStatusLabel(status: DisputeStatus) {
  switch (status) {
    case "warning_needs_response":
      return "Warning: response needed";
    case "warning_under_review":
      return "Warning under review";
    case "warning_closed":
      return "Warning closed";
    case "needs_response":
      return "Response needed";
    case "under_review":
      return "Under review";
    case "won":
      return "Won";
    case "lost":
      return "Lost";
    case "prevented":
      return "Prevented";
  }
}

export function mapStripeRefundStatus(status: string | null | undefined): RefundRecordStatus {
  switch (status) {
    case "pending":
    case "requires_action":
      return "processing";
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "canceled":
      return "cancelled";
    default:
      return "processing";
  }
}

export function mapStripeDisputeStatus(status: string): DisputeStatus {
  if (DISPUTE_STATUSES.includes(status as DisputeStatus)) {
    return status as DisputeStatus;
  }

  return "under_review";
}

type RefundAmountLike = {
  amount_cents: number;
  status: RefundRecordStatus;
};

export function getCommittedRefundTotalCents(refunds: RefundAmountLike[]) {
  return refunds.reduce((sum, refund) => {
    return REFUND_COMMITTED_STATUSES.includes(refund.status as RefundCommittedStatus) ? sum + refund.amount_cents : sum;
  }, 0);
}

export function getRemainingRefundableCents(orderTotalCents: number, refunds: RefundAmountLike[]) {
  return Math.max(0, orderTotalCents - getCommittedRefundTotalCents(refunds));
}

export function getRefundUxContract() {
  return {
    merchantSurface: "Order detail flyout",
    requiredInputs: ["refund amount", "refund reason", "customer communication decision"] as const,
    timelineEvents: [
      "refund_requested",
      "refund_processing",
      "refund_succeeded",
      "refund_failed",
      "dispute_opened",
      "dispute_updated",
      "dispute_closed"
    ] as const,
    customerComms:
      "Refund and dispute actions should generate customer-facing messaging automatically instead of relying on manual follow-up.",
    notes: REFUND_POLICY_COPY_DEFAULTS
  } as const;
}
