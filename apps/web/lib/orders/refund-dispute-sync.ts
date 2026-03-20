import type Stripe from "stripe";
import { logAuditEvent } from "@/lib/audit/log";
import { sendOrderDisputeNotification, sendOrderRefundNotification } from "@/lib/notifications/order-emails";
import { mapStripeDisputeStatus, mapStripeRefundStatus, type MerchantRefundReason } from "@/lib/orders/refunds";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { OrderDisputeRecord, OrderRefundRecord } from "@/types/database";

type RefundSyncResult = {
  refund: OrderRefundRecord | null;
  orderId: string | null;
};

function resolveRefundStatusForSync(
  existingStatus: OrderRefundRecord["status"],
  incomingStatus: OrderRefundRecord["status"]
) {
  if (isTerminalRefundStatus(existingStatus) && !isTerminalRefundStatus(incomingStatus)) {
    return existingStatus;
  }

  return incomingStatus;
}

function resolveDisputeStatusForSync(
  existingStatus: OrderDisputeRecord["status"] | null,
  incomingStatus: OrderDisputeRecord["status"]
) {
  if (existingStatus && isClosedDisputeStatus(existingStatus) && !isClosedDisputeStatus(incomingStatus)) {
    return existingStatus;
  }

  return incomingStatus;
}

function toIsoOrNull(value: number | null | undefined) {
  if (!value) {
    return null;
  }

  return new Date(value * 1000).toISOString();
}

function isTerminalRefundStatus(status: OrderRefundRecord["status"]) {
  return status === "succeeded" || status === "failed" || status === "cancelled";
}

function isClosedDisputeStatus(status: OrderDisputeRecord["status"]) {
  return status === "warning_closed" || status === "won" || status === "lost" || status === "prevented";
}

export async function syncStripeRefundRecord(
  refund: Stripe.Refund,
  options?: { refundRequestId?: string | null; processedByUserId?: string | null }
): Promise<RefundSyncResult> {
  const admin = createSupabaseAdminClient();
  const refundRequestId = options?.refundRequestId ?? refund.metadata?.refund_request_id ?? null;

  let existingRefund: Pick<
    OrderRefundRecord,
    "id" | "order_id" | "store_id" | "status" | "metadata_json" | "processed_by_user_id" | "processed_at"
  > | null = null;

  if (refundRequestId) {
    const { data } = await admin
      .from("order_refunds")
      .select("id,order_id,store_id,status,metadata_json,processed_by_user_id,processed_at")
      .eq("id", refundRequestId)
      .maybeSingle<
        Pick<OrderRefundRecord, "id" | "order_id" | "store_id" | "status" | "metadata_json" | "processed_by_user_id" | "processed_at">
      >();
    existingRefund = data ?? null;
  }

  if (!existingRefund) {
    const { data } = await admin
      .from("order_refunds")
      .select("id,order_id,store_id,status,metadata_json,processed_by_user_id,processed_at")
      .eq("stripe_refund_id", refund.id)
      .maybeSingle<
        Pick<OrderRefundRecord, "id" | "order_id" | "store_id" | "status" | "metadata_json" | "processed_by_user_id" | "processed_at">
      >();
    existingRefund = data ?? null;
  }

  if (!existingRefund) {
    return { refund: null, orderId: null };
  }

  const nextStatus = resolveRefundStatusForSync(existingRefund.status, mapStripeRefundStatus(refund.status));
  const metadataJson = {
    ...(existingRefund.metadata_json ?? {}),
    stripeStatus: refund.status ?? null,
    stripeFailureReason: refund.failure_reason ?? null,
    pendingReason: refund.pending_reason ?? null
  };

  const { data: updatedRefund, error } = await admin
    .from("order_refunds")
    .update({
      status: nextStatus,
      stripe_refund_id: refund.id,
      processed_by_user_id: options?.processedByUserId ?? existingRefund.processed_by_user_id ?? null,
      processed_at: existingRefund.processed_at ?? (isTerminalRefundStatus(nextStatus) ? new Date().toISOString() : null),
      metadata_json: metadataJson
    })
    .eq("id", existingRefund.id)
    .select("id,order_id,store_id,requested_by_user_id,processed_by_user_id,amount_cents,reason_key,reason_note,customer_message,status,stripe_refund_id,metadata_json,processed_at,created_at,updated_at")
    .single<OrderRefundRecord>();

  if (error) {
    throw new Error(error.message);
  }

  if (existingRefund.status !== nextStatus) {
    await logAuditEvent({
      storeId: updatedRefund.store_id,
      action:
        nextStatus === "succeeded"
          ? "refund_succeeded"
          : nextStatus === "failed"
            ? "refund_failed"
            : nextStatus === "cancelled"
              ? "refund_cancelled"
              : "refund_processing",
      entity: "order",
      entityId: updatedRefund.order_id,
      metadata: {
        refundId: updatedRefund.id,
        stripeRefundId: updatedRefund.stripe_refund_id,
        amountCents: updatedRefund.amount_cents,
        status: updatedRefund.status
      }
    });

    if (nextStatus === "succeeded") {
      await sendOrderRefundNotification(updatedRefund.order_id, {
        refundId: updatedRefund.id,
        amountCents: updatedRefund.amount_cents,
        reasonKey: updatedRefund.reason_key as MerchantRefundReason,
        customerMessage: updatedRefund.customer_message
      });
    }
  }

  return {
    refund: updatedRefund,
    orderId: updatedRefund.order_id
  };
}

export async function syncStripeDisputeRecord(dispute: Stripe.Dispute) {
  const admin = createSupabaseAdminClient();
  const paymentIntentId =
    typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id ?? null;

  if (!paymentIntentId) {
    return null;
  }

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id,store_id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle<{ id: string; store_id: string }>();

  if (orderError) {
    throw new Error(orderError.message);
  }

  if (!order) {
    return null;
  }

  const previousResult = await admin
    .from("order_disputes")
    .select("id,status,closed_at")
    .eq("stripe_dispute_id", dispute.id)
    .maybeSingle<Pick<OrderDisputeRecord, "id" | "status" | "closed_at">>();

  if (previousResult.error) {
    throw new Error(previousResult.error.message);
  }

  const previous = previousResult.data ?? null;
  const responseDueBy = toIsoOrNull(dispute.evidence_details?.due_by ?? null);
  const stripeChargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id ?? null;
  const nextStatus = resolveDisputeStatusForSync(previous?.status ?? null, mapStripeDisputeStatus(dispute.status));

  const { data: syncedDispute, error } = await admin
    .from("order_disputes")
    .upsert(
      {
        order_id: order.id,
        store_id: order.store_id,
        stripe_dispute_id: dispute.id,
        stripe_charge_id: stripeChargeId,
        stripe_payment_intent_id: paymentIntentId,
        amount_cents: dispute.amount,
        currency: dispute.currency,
        reason: dispute.reason,
        status: nextStatus,
        is_charge_refundable: dispute.is_charge_refundable,
        response_due_by: responseDueBy,
        metadata_json: {
          networkReasonCode: dispute.network_reason_code ?? null,
          evidenceSubmissionCount: dispute.evidence_details?.submission_count ?? 0,
          hasEvidence: dispute.evidence_details?.has_evidence ?? false,
          pastDue: dispute.evidence_details?.past_due ?? false
        },
        closed_at: previous?.closed_at ?? (isClosedDisputeStatus(nextStatus) ? new Date().toISOString() : null)
      },
      { onConflict: "stripe_dispute_id" }
    )
    .select("id,order_id,store_id,stripe_dispute_id,stripe_charge_id,stripe_payment_intent_id,amount_cents,currency,reason,status,is_charge_refundable,response_due_by,metadata_json,closed_at,created_at,updated_at")
    .single<OrderDisputeRecord>();

  if (error) {
    throw new Error(error.message);
  }

  if (!previous) {
    await logAuditEvent({
      storeId: syncedDispute.store_id,
      action: "dispute_opened",
      entity: "order",
      entityId: syncedDispute.order_id,
      metadata: {
        disputeId: syncedDispute.id,
        stripeDisputeId: syncedDispute.stripe_dispute_id,
        amountCents: syncedDispute.amount_cents,
        status: syncedDispute.status,
        reason: syncedDispute.reason
      }
    });
    await sendOrderDisputeNotification(syncedDispute.order_id, {
      disputeId: syncedDispute.id,
      status: syncedDispute.status,
      amountCents: syncedDispute.amount_cents,
      reason: syncedDispute.reason,
      responseDueBy: syncedDispute.response_due_by
    });
  } else if (previous.status !== syncedDispute.status) {
    await logAuditEvent({
      storeId: syncedDispute.store_id,
      action: isClosedDisputeStatus(syncedDispute.status) ? "dispute_closed" : "dispute_updated",
      entity: "order",
      entityId: syncedDispute.order_id,
      metadata: {
        disputeId: syncedDispute.id,
        stripeDisputeId: syncedDispute.stripe_dispute_id,
        previousStatus: previous.status,
        status: syncedDispute.status,
        reason: syncedDispute.reason
      }
    });

    await sendOrderDisputeNotification(syncedDispute.order_id, {
      disputeId: syncedDispute.id,
      status: syncedDispute.status,
      amountCents: syncedDispute.amount_cents,
      reason: syncedDispute.reason,
      responseDueBy: syncedDispute.response_due_by
    });
  }

  return syncedDispute;
}
