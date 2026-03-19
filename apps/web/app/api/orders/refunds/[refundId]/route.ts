import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isStripeStubMode } from "@/lib/env";
import { logAuditEvent } from "@/lib/audit/log";
import { sendOrderRefundNotification } from "@/lib/notifications/order-emails";
import { mapStripeRefundStatus, STRIPE_REFUND_REASON_MAP, type MerchantRefundReason } from "@/lib/orders/refunds";
import { syncStripeRefundRecord } from "@/lib/orders/refund-dispute-sync";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getStripeClient } from "@/lib/stripe/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { OrderRefundRecord } from "@/types/database";

const paramsSchema = z.object({
  refundId: z.string().uuid()
});

const payloadSchema = z.object({
  action: z.literal("process")
});

type RouteContext = {
  params: Promise<{ refundId: string }>;
};

type RefundExecutionLookupRow = {
  id: string;
  order_id: string;
  store_id: string;
  amount_cents: number;
  reason_key: keyof typeof STRIPE_REFUND_REASON_MAP;
  status: OrderRefundRecord["status"];
  stripe_refund_id: string | null;
  metadata_json: Record<string, unknown>;
  orders: {
    id: string;
    status: "pending" | "paid" | "failed" | "cancelled";
    stripe_payment_intent_id: string | null;
  } | null;
};

function isStubPaymentIntentId(paymentIntentId: string | null | undefined) {
  return typeof paymentIntentId === "string" && paymentIntentId.startsWith("stub_pi_");
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const trustedOriginResponse = enforceTrustedOrigin(request);

  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json({ error: "Invalid refund id" }, { status: 400 });
  }

  const payload = await parseJsonRequest(request, payloadSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await getOwnedStoreBundle(user.id, "staff");

  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  const admin = createSupabaseAdminClient();
  const { data: refund, error: refundError } = await admin
    .from("order_refunds")
    .select("id,order_id,store_id,amount_cents,reason_key,status,stripe_refund_id,metadata_json,orders(id,status,stripe_payment_intent_id)")
    .eq("id", params.data.refundId)
    .eq("store_id", bundle.store.id)
    .maybeSingle<RefundExecutionLookupRow>();

  if (refundError) {
    return NextResponse.json({ error: refundError.message }, { status: 500 });
  }

  if (!refund || !refund.orders) {
    return NextResponse.json({ error: "Refund request not found" }, { status: 404 });
  }

  if (refund.status !== "requested" && refund.status !== "failed") {
    return NextResponse.json({ error: "Only requested or failed refund records can be processed." }, { status: 400 });
  }

  if (refund.orders.status !== "paid") {
    return NextResponse.json({ error: "Only paid orders can be refunded." }, { status: 400 });
  }

  await admin
    .from("order_refunds")
    .update({
      status: "processing",
      metadata_json: {
        ...(refund.metadata_json ?? {}),
        processingStartedAt: new Date().toISOString(),
        processedByUserId: user.id
      }
    })
    .eq("id", refund.id);

  await logAuditEvent({
    storeId: bundle.store.id,
    actorUserId: user.id,
    action: "refund_processing",
    entity: "order",
    entityId: refund.order_id,
    metadata: {
      refundId: refund.id,
      amountCents: refund.amount_cents
    }
  });

  const shouldUseStubMode = isStripeStubMode() || isStubPaymentIntentId(refund.orders.stripe_payment_intent_id);

  if (shouldUseStubMode || !refund.orders.stripe_payment_intent_id) {
    const { data: stubbedRefund, error: stubError } = await admin
      .from("order_refunds")
      .update({
        status: "succeeded",
        processed_by_user_id: user.id,
        processed_at: new Date().toISOString(),
        metadata_json: {
          ...(refund.metadata_json ?? {}),
          processedMode: "stub"
        }
      })
      .eq("id", refund.id)
      .select("id,order_id,store_id,requested_by_user_id,processed_by_user_id,amount_cents,reason_key,reason_note,customer_message,status,stripe_refund_id,metadata_json,processed_at,created_at,updated_at")
      .single<OrderRefundRecord>();

    if (stubError) {
      return NextResponse.json({ error: stubError.message }, { status: 500 });
    }

    await logAuditEvent({
      storeId: bundle.store.id,
      actorUserId: user.id,
      action: "refund_succeeded",
      entity: "order",
      entityId: refund.order_id,
      metadata: {
        refundId: refund.id,
        amountCents: refund.amount_cents,
        processedMode: "stub"
      }
    });

      await sendOrderRefundNotification(refund.order_id, {
        refundId: stubbedRefund.id,
        amountCents: stubbedRefund.amount_cents,
        reasonKey: stubbedRefund.reason_key as MerchantRefundReason,
        customerMessage: stubbedRefund.customer_message
      });

    return NextResponse.json({ refund: stubbedRefund });
  }

  try {
    const stripeRefund = await getStripeClient().refunds.create({
      payment_intent: refund.orders.stripe_payment_intent_id,
      amount: refund.amount_cents,
      reason: STRIPE_REFUND_REASON_MAP[refund.reason_key] ?? undefined,
      metadata: {
        order_id: refund.order_id,
        refund_request_id: refund.id,
        store_id: bundle.store.id
      }
    });

    const synced = await syncStripeRefundRecord(stripeRefund, { refundRequestId: refund.id, processedByUserId: user.id });

    return NextResponse.json({ refund: synced.refund });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe refund failed.";
    const nextStatus = mapStripeRefundStatus("failed");
    const { data: failedRefund, error: failedUpdateError } = await admin
      .from("order_refunds")
      .update({
        status: nextStatus,
        processed_by_user_id: user.id,
        processed_at: new Date().toISOString(),
        metadata_json: {
          ...(refund.metadata_json ?? {}),
          stripeError: message
        }
      })
      .eq("id", refund.id)
      .select("id,order_id,store_id,requested_by_user_id,processed_by_user_id,amount_cents,reason_key,reason_note,customer_message,status,stripe_refund_id,metadata_json,processed_at,created_at,updated_at")
      .single<OrderRefundRecord>();

    if (!failedUpdateError) {
      await logAuditEvent({
        storeId: bundle.store.id,
        actorUserId: user.id,
        action: "refund_failed",
        entity: "order",
        entityId: refund.order_id,
        metadata: {
          refundId: refund.id,
          amountCents: refund.amount_cents,
          error: message
        }
      });
    }

    return NextResponse.json({ error: message, refund: failedRefund ?? null }, { status: 502 });
  }
}
