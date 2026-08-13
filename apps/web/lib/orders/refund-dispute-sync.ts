import type Stripe from "stripe";
import {
  syncDisputeDigitalAccess,
  syncRefundDigitalAccess,
} from "@/lib/digital-products/access-state";
import {
  sendOrderDisputeNotification,
  sendOrderRefundNotification,
} from "@/lib/notifications/order-emails";
import {
  mapStripeDisputeStatus,
  mapStripeRefundStatus,
  type MerchantRefundReason,
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

  if (transition.stateChanged && transition.record.status === "succeeded") {
    await sendOrderRefundNotification(transition.record.order_id, {
      refundId: transition.record.id,
      amountCents: transition.record.amount_cents,
      reasonKey: transition.record.reason_key as MerchantRefundReason,
      customerMessage: transition.record.customer_message,
    });
  }

  return {
    refund: transition.record,
    orderId: transition.record.order_id,
  };
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
  if (!order) return null;

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

  if (transition.stateChanged && transition.record) {
    await sendOrderDisputeNotification(transition.record.order_id, {
      disputeId: transition.record.id,
      status: transition.record.status,
      amountCents: transition.record.amount_cents,
      reason: transition.record.reason,
      responseDueBy: transition.record.response_due_by,
    });
  }

  return transition.record;
}
