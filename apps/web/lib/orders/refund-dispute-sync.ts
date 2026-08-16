import type Stripe from "stripe";
import {
  claimRefundForProcessing,
  syncDisputeDigitalAccess,
  syncRefundDigitalAccess,
} from "@/lib/digital-products/access-state";
import {
  mapStripeDisputeStatus,
  mapStripeRefundStatus,
} from "@/lib/orders/refunds";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { OrderRefundRecord } from "@/types/database";

type RefundSyncResult = {
  refund: OrderRefundRecord | null;
  orderId: string | null;
};

type FinancialSource = {
  sourceEventId?: string;
  sourceEventCreatedAt?: string;
};

export { claimRefundForProcessing };

function toIsoOrNull(value: number | null | undefined) {
  if (!value) return null;
  return new Date(value * 1000).toISOString();
}

function requireSource(
  source: FinancialSource,
  fallbackId: string,
  fallbackCreatedSeconds: number,
) {
  const sourceEventId = source.sourceEventId?.trim() || fallbackId;
  const sourceEventCreatedAt =
    source.sourceEventCreatedAt ?? toIsoOrNull(fallbackCreatedSeconds);
  if (!sourceEventCreatedAt) {
    throw new Error("Financial event source timestamp is required");
  }
  return { sourceEventId, sourceEventCreatedAt };
}

export async function syncStripeRefundRecord(
  refund: Stripe.Refund,
  options?: FinancialSource & {
    refundRequestId?: string | null;
    processedByUserId?: string | null;
  },
): Promise<RefundSyncResult> {
  const source = requireSource(
    options ?? {},
    `refund_api:${refund.id}:${refund.status ?? "unknown"}`,
    refund.created,
  );
  const transition = await syncRefundDigitalAccess({
    refundRequestId:
      options?.refundRequestId ?? refund.metadata?.refund_request_id ?? null,
    stripeRefundId: refund.id,
    status: mapStripeRefundStatus(refund.status),
    stripeStatus: refund.status ?? null,
    stripeFailureReason: refund.failure_reason ?? null,
    pendingReason: refund.pending_reason ?? null,
    processedByUserId: options?.processedByUserId ?? null,
    ...source,
  });

  if (!transition.record) {
    return { refund: null, orderId: null };
  }

  return {
    refund: transition.record,
    orderId: transition.record.order_id,
  };
}

export class UnknownDisputedPaymentError extends Error {
  constructor(paymentIntentId: string) {
    super(`No order is recorded for disputed payment ${paymentIntentId}.`);
    this.name = "UnknownDisputedPaymentError";
  }
}

export async function syncStripeDisputeRecord(
  dispute: Stripe.Dispute,
  options?: FinancialSource,
) {
  const paymentIntentId =
    typeof dispute.payment_intent === "string"
      ? dispute.payment_intent
      : dispute.payment_intent?.id ?? null;
  if (!paymentIntentId) return null;

  const admin = createSupabaseAdminClient();
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id,store_id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle<{ id: string; store_id: string }>();
  if (orderError) throw new Error(orderError.message);
  // A dispute can be raised before the paid checkout has finished creating its
  // order. Reporting success would retire the event permanently, leaving the
  // store unaware of the dispute and the buyer's access unsuspended, so fail
  // and let the provider redeliver once the order exists.
  if (!order) throw new UnknownDisputedPaymentError(paymentIntentId);

  const source = requireSource(
    options ?? {},
    `dispute_api:${dispute.id}:${dispute.status}`,
    dispute.created,
  );
  const transition = await syncDisputeDigitalAccess({
    orderId: order.id,
    storeId: order.store_id,
    stripeDisputeId: dispute.id,
    stripeChargeId:
      typeof dispute.charge === "string"
        ? dispute.charge
        : dispute.charge?.id ?? null,
    stripePaymentIntentId: paymentIntentId,
    amountCents: dispute.amount,
    currency: dispute.currency,
    reason: dispute.reason,
    status: mapStripeDisputeStatus(dispute.status),
    isChargeRefundable: dispute.is_charge_refundable,
    responseDueBy: toIsoOrNull(dispute.evidence_details?.due_by ?? null),
    metadata: {
      networkReasonCode: dispute.network_reason_code ?? null,
      evidenceSubmissionCount: dispute.evidence_details?.submission_count ?? 0,
      hasEvidence: dispute.evidence_details?.has_evidence ?? false,
      pastDue: dispute.evidence_details?.past_due ?? false,
    },
    ...source,
  });

  return transition.record;
}
