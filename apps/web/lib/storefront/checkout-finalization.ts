import { calculatePlatformFeeCents, resolveStoreFeeProfile, writeOrderFeeBreakdown } from "@/lib/billing/fees";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendOrderCreatedNotifications } from "@/lib/notifications/order-emails";

type StorefrontCheckoutRecord = {
  id: string;
  store_id: string;
  store_slug: string;
  customer_email: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_phone: string | null;
  customer_note: string | null;
  fulfillment_method: "pickup" | "shipping" | null;
  fulfillment_label: string | null;
  pickup_location_id: string | null;
  pickup_location_snapshot_json: Record<string, unknown> | null;
  pickup_window_start_at: string | null;
  pickup_window_end_at: string | null;
  pickup_timezone: string | null;
  shipping_fee_cents: number | null;
  promo_code: string | null;
  items: unknown;
  order_id: string | null;
  status: "pending" | "completed" | "failed";
};

export async function finalizeStorefrontCheckout(checkoutId: string, paymentIntentId: string | null) {
  const supabase = createSupabaseAdminClient();

  const { data: checkout, error: checkoutError } = await supabase
    .from("storefront_checkout_sessions")
    .select(
      "id,store_id,store_slug,customer_email,customer_first_name,customer_last_name,customer_phone,customer_note,fulfillment_method,fulfillment_label,pickup_location_id,pickup_location_snapshot_json,pickup_window_start_at,pickup_window_end_at,pickup_timezone,shipping_fee_cents,promo_code,items,order_id,status"
    )
    .eq("id", checkoutId)
    .maybeSingle<StorefrontCheckoutRecord>();

  if (checkoutError) {
    throw new Error(checkoutError.message);
  }

  if (!checkout) {
    return { status: "missing" as const, orderId: null };
  }

  if (checkout.status === "completed" && checkout.order_id) {
    return { status: "completed" as const, orderId: checkout.order_id };
  }

  if (paymentIntentId) {
    const { data: existingOrder, error: existingOrderError } = await supabase
      .from("orders")
      .select("id")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle<{ id: string }>();

    if (existingOrderError) {
      throw new Error(existingOrderError.message);
    }

    if (existingOrder) {
      const { data: existingOrderRow, error: existingOrderFetchError } = await supabase
        .from("orders")
        .select("subtotal_cents,discount_cents")
        .eq("id", existingOrder.id)
        .single<{ subtotal_cents: number; discount_cents: number }>();

      if (existingOrderFetchError || !existingOrderRow) {
        throw new Error(existingOrderFetchError?.message ?? "Unable to resolve existing order totals.");
      }

      const shippingFeeCents = Math.max(0, checkout.shipping_fee_cents ?? 0);
      const computedTotalCents = Math.max(0, existingOrderRow.subtotal_cents - existingOrderRow.discount_cents) + shippingFeeCents;
      const feeProfile = await resolveStoreFeeProfile(checkout.store_id);
      const platformFeeCents = calculatePlatformFeeCents(
        Math.max(0, existingOrderRow.subtotal_cents - existingOrderRow.discount_cents),
        feeProfile
      );

      const { error: orderSyncError } = await supabase
        .from("orders")
        .update({
          customer_first_name: checkout.customer_first_name,
          customer_last_name: checkout.customer_last_name,
          customer_phone: checkout.customer_phone,
          customer_note: checkout.customer_note,
          fulfillment_method: checkout.fulfillment_method,
          fulfillment_label: checkout.fulfillment_label,
          pickup_location_id: checkout.pickup_location_id,
          pickup_location_snapshot_json: checkout.pickup_location_snapshot_json,
          pickup_window_start_at: checkout.pickup_window_start_at,
          pickup_window_end_at: checkout.pickup_window_end_at,
          pickup_timezone: checkout.pickup_timezone,
          shipping_fee_cents: shippingFeeCents,
          platform_fee_bps: feeProfile.feeBps,
          platform_fee_cents: platformFeeCents,
          total_cents: computedTotalCents
        })
        .eq("id", existingOrder.id);

      if (orderSyncError) {
        throw new Error(orderSyncError.message);
      }

      const { error: updateError } = await supabase
        .from("storefront_checkout_sessions")
        .update({
          status: "completed",
          order_id: existingOrder.id,
          stripe_payment_intent_id: paymentIntentId,
          error_message: null
        })
        .eq("id", checkout.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      await writeOrderFeeBreakdown({
        orderId: existingOrder.id,
        storeId: checkout.store_id,
        subtotalCents: existingOrderRow.subtotal_cents,
        feeProfile,
        platformFeeCents,
        netPayoutCents: Math.max(0, computedTotalCents - platformFeeCents)
      });

      await sendOrderCreatedNotifications(existingOrder.id);

      return { status: "completed" as const, orderId: existingOrder.id };
    }
  }

  const { data: rpcResult, error: rpcError } = await supabase.rpc("stub_checkout_create_paid_order", {
    p_store_slug: checkout.store_slug,
    p_customer_email: checkout.customer_email,
    p_items: checkout.items,
    p_stub_payment_ref: paymentIntentId,
    p_promo_code: checkout.promo_code
  });

  if (rpcError) {
    const { error: markFailedError } = await supabase
      .from("storefront_checkout_sessions")
      .update({ status: "failed", error_message: rpcError.message, stripe_payment_intent_id: paymentIntentId })
      .eq("id", checkout.id);

    if (markFailedError) {
      throw new Error(`${rpcError.message} | Failed to mark checkout as failed: ${markFailedError.message}`);
    }

    throw new Error(rpcError.message);
  }

  const finalized = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
  const orderId = finalized?.order_id as string | undefined;

  if (!orderId) {
    throw new Error("Checkout finalization did not return order id.");
  }

  const { data: createdOrderRow, error: createdOrderFetchError } = await supabase
    .from("orders")
    .select("subtotal_cents,discount_cents")
    .eq("id", orderId)
    .single<{ subtotal_cents: number; discount_cents: number }>();

  if (createdOrderFetchError || !createdOrderRow) {
    throw new Error(createdOrderFetchError?.message ?? "Unable to resolve order totals.");
  }

  const shippingFeeCents = Math.max(0, checkout.shipping_fee_cents ?? 0);
  const computedTotalCents = Math.max(0, createdOrderRow.subtotal_cents - createdOrderRow.discount_cents) + shippingFeeCents;
  const feeProfile = await resolveStoreFeeProfile(checkout.store_id);
  const platformFeeCents = calculatePlatformFeeCents(
    Math.max(0, createdOrderRow.subtotal_cents - createdOrderRow.discount_cents),
    feeProfile
  );

  const { error: orderSyncError } = await supabase
    .from("orders")
    .update({
      customer_first_name: checkout.customer_first_name,
      customer_last_name: checkout.customer_last_name,
      customer_phone: checkout.customer_phone,
      customer_note: checkout.customer_note,
      fulfillment_method: checkout.fulfillment_method,
      fulfillment_label: checkout.fulfillment_label,
      pickup_location_id: checkout.pickup_location_id,
      pickup_location_snapshot_json: checkout.pickup_location_snapshot_json,
      pickup_window_start_at: checkout.pickup_window_start_at,
      pickup_window_end_at: checkout.pickup_window_end_at,
      pickup_timezone: checkout.pickup_timezone,
      shipping_fee_cents: shippingFeeCents,
      platform_fee_bps: feeProfile.feeBps,
      platform_fee_cents: platformFeeCents,
      total_cents: computedTotalCents
    })
    .eq("id", orderId);

  if (orderSyncError) {
    throw new Error(orderSyncError.message);
  }

  const { error: updateError } = await supabase
    .from("storefront_checkout_sessions")
    .update({
      status: "completed",
      order_id: orderId,
      stripe_payment_intent_id: paymentIntentId,
      error_message: null
    })
    .eq("id", checkout.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await writeOrderFeeBreakdown({
    orderId,
    storeId: checkout.store_id,
    subtotalCents: createdOrderRow.subtotal_cents,
    feeProfile,
    platformFeeCents,
    netPayoutCents: Math.max(0, computedTotalCents - platformFeeCents)
  });

  await sendOrderCreatedNotifications(orderId);

  return { status: "completed" as const, orderId };
}

export async function getStorefrontCheckoutBySessionId(storeSlug: string, sessionId: string) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("storefront_checkout_sessions")
    .select("id,status,order_id,error_message,stripe_payment_intent_id")
    .eq("store_slug", storeSlug)
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle<{
      id: string;
      status: "pending" | "completed" | "failed";
      order_id: string | null;
      error_message: string | null;
      stripe_payment_intent_id: string | null;
    }>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
