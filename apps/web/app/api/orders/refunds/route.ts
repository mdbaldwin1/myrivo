import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { MerchantRefundReason, MERCHANT_REFUND_REASONS, getRemainingRefundableCents } from "@/lib/orders/refunds";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { OrderRefundRecord } from "@/types/database";

const createRefundSchema = z
  .object({
    orderId: z.string().uuid(),
    mode: z.enum(["full", "partial"]),
    amountCents: z.number().int().positive().optional(),
    reasonKey: z.enum(MERCHANT_REFUND_REASONS),
    reasonNote: z.string().trim().max(1000).optional().nullable(),
    customerMessage: z.string().trim().max(2000).optional().nullable()
  })
  .superRefine((value, ctx) => {
    if (value.mode === "partial" && value.amountCents === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amountCents"],
        message: "Partial refunds require an amount."
      });
    }
  });

type OrderRow = {
  id: string;
  store_id: string;
  status: "pending" | "paid" | "failed" | "cancelled";
  total_cents: number;
  customer_email: string;
};

type RefundInsertRow = {
  order_id: string;
  store_id: string;
  requested_by_user_id: string;
  amount_cents: number;
  reason_key: MerchantRefundReason;
  reason_note: string | null;
  customer_message: string | null;
  status: "requested";
  metadata_json: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);

  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, createRefundSchema);
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

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id,store_id,status,total_cents,customer_email")
    .eq("id", payload.data.orderId)
    .eq("store_id", bundle.store.id)
    .maybeSingle<OrderRow>();

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "paid") {
    return NextResponse.json({ error: "Only paid orders can be refunded from this screen." }, { status: 400 });
  }

  const { data: existingRefunds, error: refundLookupError } = await admin
    .from("order_refunds")
    .select("amount_cents,status")
    .eq("order_id", order.id)
    .eq("store_id", bundle.store.id)
    .returns<Array<Pick<OrderRefundRecord, "amount_cents" | "status">>>();

  if (refundLookupError) {
    return NextResponse.json({ error: refundLookupError.message }, { status: 500 });
  }

  const remainingRefundableCents = getRemainingRefundableCents(order.total_cents, existingRefunds ?? []);

  if (remainingRefundableCents <= 0) {
    return NextResponse.json({ error: "This order has no refundable balance remaining." }, { status: 400 });
  }

  const requestedAmountCents =
    payload.data.mode === "full" ? remainingRefundableCents : Math.min(payload.data.amountCents ?? 0, remainingRefundableCents);

  if (requestedAmountCents <= 0) {
    return NextResponse.json({ error: "Refund amount must be greater than zero." }, { status: 400 });
  }

  if (payload.data.mode === "partial" && payload.data.amountCents && payload.data.amountCents > remainingRefundableCents) {
    return NextResponse.json(
      {
        error: `Only $${(remainingRefundableCents / 100).toFixed(2)} remains refundable on this order.`
      },
      { status: 400 }
    );
  }

  const insertPayload: RefundInsertRow = {
    order_id: order.id,
    store_id: bundle.store.id,
    requested_by_user_id: user.id,
    amount_cents: requestedAmountCents,
    reason_key: payload.data.reasonKey,
    reason_note: payload.data.reasonNote?.trim() || null,
    customer_message: payload.data.customerMessage?.trim() || null,
    status: "requested",
    metadata_json: {
      mode: payload.data.mode,
      orderStatusAtRequest: order.status,
      customerEmail: order.customer_email
    }
  };

  const { data: refund, error: refundError } = await admin
    .from("order_refunds")
    .insert(insertPayload)
    .select("id,order_id,store_id,requested_by_user_id,processed_by_user_id,amount_cents,reason_key,reason_note,customer_message,status,stripe_refund_id,metadata_json,processed_at,created_at,updated_at")
    .single<OrderRefundRecord>();

  if (refundError) {
    return NextResponse.json({ error: refundError.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: bundle.store.id,
    actorUserId: user.id,
    action: "refund_requested",
    entity: "order",
    entityId: order.id,
    metadata: {
      refundId: refund.id,
      amountCents: refund.amount_cents,
      reasonKey: refund.reason_key,
      status: refund.status,
      customerMessageIncluded: Boolean(refund.customer_message)
    }
  });

  return NextResponse.json({
    refund,
    remainingRefundableCents: Math.max(0, remainingRefundableCents - refund.amount_cents)
  });
}
