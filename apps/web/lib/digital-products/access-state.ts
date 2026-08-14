import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  OrderDisputeRecord,
  OrderDisputeStatus,
  OrderRefundRecord,
  OrderRefundStatus,
} from "@/types/database";

type RpcResult = {
  data: unknown;
  error: { message?: string } | null;
};

export type DigitalAccessStateRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;
};

const refundRecordSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  store_id: z.string().uuid(),
  requested_by_user_id: z.string().uuid().nullable(),
  processed_by_user_id: z.string().uuid().nullable(),
  amount_cents: z.number().int().positive(),
  reason_key: z.string().trim().min(1),
  reason_note: z.string().nullable(),
  customer_message: z.string().nullable(),
  status: z.enum(["requested", "processing", "succeeded", "failed", "cancelled"]),
  stripe_refund_id: z.string().nullable(),
  metadata_json: z.record(z.string(), z.unknown()),
  processed_at: z.string().datetime({ offset: true }).nullable(),
  source_event_id: z.string().nullable(),
  source_event_created_at: z.string().datetime({ offset: true }).nullable(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
}).strict();

const disputeRecordSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  store_id: z.string().uuid(),
  stripe_dispute_id: z.string().trim().min(1),
  stripe_charge_id: z.string().nullable(),
  stripe_payment_intent_id: z.string().nullable(),
  amount_cents: z.number().int().positive(),
  currency: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  status: z.enum([
    "warning_needs_response",
    "warning_under_review",
    "warning_closed",
    "needs_response",
    "under_review",
    "won",
    "lost",
    "prevented",
  ]),
  is_charge_refundable: z.boolean(),
  response_due_by: z.string().datetime({ offset: true }).nullable(),
  metadata_json: z.record(z.string(), z.unknown()),
  closed_at: z.string().datetime({ offset: true }).nullable(),
  source_event_id: z.string().nullable(),
  source_event_created_at: z.string().datetime({ offset: true }).nullable(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
}).strict();

const transitionFields = {
  applied: z.boolean(),
  state_changed: z.boolean(),
  access_changed: z.boolean(),
  effective_access_state: z.enum(["active", "suspended", "revoked", "not_applicable"]),
};

const refundTransitionSchema = z.object({
  ...transitionFields,
  record: refundRecordSchema.nullable(),
}).strict();

const disputeTransitionSchema = z.object({
  ...transitionFields,
  record: disputeRecordSchema.nullable(),
}).strict();

const refundClaimSchema = z.object({
  claimed: z.boolean(),
  record: refundRecordSchema,
}).strict();

function unwrapRpc<T>(result: RpcResult, schema: z.ZodType<T>, operation: string): T {
  if (result.error) {
    throw new Error(result.error.message || `${operation} failed`);
  }

  const parsed = schema.safeParse(result.data);
  if (!parsed.success) {
    throw new Error(`${operation} returned an invalid result`);
  }

  return parsed.data;
}

export async function claimRefundForProcessing({
  refundId,
  storeId,
  processedByUserId,
  client = createSupabaseAdminClient(),
}: {
  refundId: string;
  storeId: string;
  processedByUserId: string;
  client?: DigitalAccessStateRpcClient;
}) {
  const result = await client.rpc("claim_refund_for_processing", {
    p_refund_id: refundId,
    p_store_id: storeId,
    p_processed_by_user_id: processedByUserId,
  });
  const parsed = unwrapRpc(result, refundClaimSchema, "Refund processing claim");
  return {
    claimed: parsed.claimed,
    record: parsed.record as OrderRefundRecord,
  };
}

export async function syncRefundDigitalAccess({
  refundRequestId,
  stripeRefundId,
  status,
  stripeStatus,
  stripeFailureReason,
  pendingReason,
  processedByUserId,
  sourceEventId,
  sourceEventCreatedAt,
  client = createSupabaseAdminClient(),
}: {
  refundRequestId: string | null;
  stripeRefundId: string;
  status: OrderRefundStatus;
  stripeStatus: string | null;
  stripeFailureReason: string | null;
  pendingReason: string | null;
  processedByUserId: string | null;
  sourceEventId: string;
  sourceEventCreatedAt: string;
  client?: DigitalAccessStateRpcClient;
}) {
  const result = await client.rpc("sync_refund_digital_access", {
    p_refund_request_id: refundRequestId,
    p_stripe_refund_id: stripeRefundId,
    p_incoming_status: status,
    p_stripe_status: stripeStatus,
    p_stripe_failure_reason: stripeFailureReason,
    p_pending_reason: pendingReason,
    p_processed_by_user_id: processedByUserId,
    p_source_event_id: sourceEventId,
    p_source_event_created_at: sourceEventCreatedAt,
  });
  const parsed = unwrapRpc(result, refundTransitionSchema, "Refund access synchronization");

  return {
    applied: parsed.applied,
    stateChanged: parsed.state_changed,
    accessChanged: parsed.access_changed,
    effectiveAccessState: parsed.effective_access_state,
    record: parsed.record as (OrderRefundRecord & {
      source_event_id: string | null;
      source_event_created_at: string | null;
    }) | null,
  };
}

export async function syncDisputeDigitalAccess({
  orderId,
  storeId,
  stripeDisputeId,
  stripeChargeId,
  stripePaymentIntentId,
  amountCents,
  currency,
  reason,
  status,
  isChargeRefundable,
  responseDueBy,
  metadata,
  sourceEventId,
  sourceEventCreatedAt,
  client = createSupabaseAdminClient(),
}: {
  orderId: string;
  storeId: string;
  stripeDisputeId: string;
  stripeChargeId: string | null;
  stripePaymentIntentId: string;
  amountCents: number;
  currency: string;
  reason: string;
  status: OrderDisputeStatus;
  isChargeRefundable: boolean;
  responseDueBy: string | null;
  metadata: Record<string, unknown>;
  sourceEventId: string;
  sourceEventCreatedAt: string;
  client?: DigitalAccessStateRpcClient;
}) {
  const result = await client.rpc("sync_dispute_digital_access", {
    p_order_id: orderId,
    p_store_id: storeId,
    p_stripe_dispute_id: stripeDisputeId,
    p_stripe_charge_id: stripeChargeId,
    p_stripe_payment_intent_id: stripePaymentIntentId,
    p_amount_cents: amountCents,
    p_currency: currency,
    p_reason: reason,
    p_incoming_status: status,
    p_is_charge_refundable: isChargeRefundable,
    p_response_due_by: responseDueBy,
    p_metadata_json: metadata,
    p_source_event_id: sourceEventId,
    p_source_event_created_at: sourceEventCreatedAt,
  });
  const parsed = unwrapRpc(result, disputeTransitionSchema, "Dispute access synchronization");

  return {
    applied: parsed.applied,
    stateChanged: parsed.state_changed,
    accessChanged: parsed.access_changed,
    effectiveAccessState: parsed.effective_access_state,
    record: parsed.record as (OrderDisputeRecord & {
      source_event_id: string | null;
      source_event_created_at: string | null;
    }) | null,
  };
}

const reconciliationIssueSchema = z.object({
  issue_type: z.enum([
    "paid_order_missing_delivery_job",
    "paid_order_missing_entitlements",
    "full_refund_active_access",
    "open_dispute_access_mismatch",
    "lost_dispute_access_mismatch",
    "token_access_mismatch",
  ]),
  order_id: z.string().uuid(),
  store_id: z.string().uuid(),
  entitlement_count: z.number().int().nonnegative(),
  token_count: z.number().int().nonnegative(),
}).strict();

export type DigitalAccessReconciliationIssue = {
  issueType: z.infer<typeof reconciliationIssueSchema>["issue_type"];
  orderId: string;
  storeId: string;
  entitlementCount: number;
  tokenCount: number;
};

export async function listDigitalAccessReconciliationIssues({
  limit = 100,
  client = createSupabaseAdminClient(),
}: {
  limit?: number;
  client?: DigitalAccessStateRpcClient;
} = {}): Promise<DigitalAccessReconciliationIssue[]> {
  const boundedLimit = z.number().int().min(1).max(500).parse(limit);
  const result = await client.rpc("find_digital_access_reconciliation_issues", {
    p_limit: boundedLimit,
  });
  const rows = unwrapRpc(
    result,
    z.array(reconciliationIssueSchema),
    "Digital access reconciliation",
  );

  return rows.map((row) => ({
    issueType: row.issue_type,
    orderId: row.order_id,
    storeId: row.store_id,
    entitlementCount: row.entitlement_count,
    tokenCount: row.token_count,
  }));
}
