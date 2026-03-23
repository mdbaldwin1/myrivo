import { calculatePlatformFeeCents, resolveStoreFeeProfile, writeOrderFeeBreakdown } from "@/lib/billing/fees";
import { isStripeStubMode } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendOrderCreatedNotifications } from "@/lib/notifications/order-emails";
import { buildStubCheckoutRpcPayload } from "@/lib/storefront/stub-checkout";
import { isStorePubliclyAccessibleStatus } from "@/lib/stores/lifecycle";
import { getStripeClient } from "@/lib/stripe/server";

type StorefrontCheckoutRecord = {
  id: string;
  store_id: string;
  store_slug: string;
  analytics_session_id: string | null;
  analytics_session_key: string | null;
  source_cart_id: string | null;
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
  fee_plan_key: string | null;
  fee_bps: number | null;
  fee_fixed_cents: number | null;
  item_total_cents: number | null;
  platform_fee_cents: number | null;
  items: unknown;
  order_id: string | null;
  status: "pending" | "completed" | "failed";
};

async function resolveCheckoutCustomerUserId(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  sourceCartId: string | null
) {
  if (!sourceCartId) {
    return null;
  }

  const { data, error } = await supabase
    .from("customer_carts")
    .select("user_id")
    .eq("id", sourceCartId)
    .maybeSingle<{ user_id: string | null }>();

  if (error) {
    throw new Error(error.message);
  }

  return data?.user_id ?? null;
}

function resolveCheckoutFeeSnapshot(checkout: StorefrontCheckoutRecord, fallback: Awaited<ReturnType<typeof resolveStoreFeeProfile>>) {
  return {
    planKey: checkout.fee_plan_key ?? fallback.planKey,
    feeBps: checkout.fee_bps ?? fallback.feeBps,
    feeFixedCents: checkout.fee_fixed_cents ?? fallback.feeFixedCents
  };
}

export async function finalizeStorefrontCheckout(checkoutId: string, paymentIntentId: string | null) {
  const supabase = createSupabaseAdminClient();

  const { data: checkout, error: checkoutError } = await supabase
    .from("storefront_checkout_sessions")
    .select(
      "id,store_id,store_slug,analytics_session_id,analytics_session_key,source_cart_id,customer_email,customer_first_name,customer_last_name,customer_phone,customer_note,fulfillment_method,fulfillment_label,pickup_location_id,pickup_location_snapshot_json,pickup_window_start_at,pickup_window_end_at,pickup_timezone,shipping_fee_cents,promo_code,fee_plan_key,fee_bps,fee_fixed_cents,item_total_cents,platform_fee_cents,items,order_id,status"
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

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("status")
    .eq("id", checkout.store_id)
    .maybeSingle<{
      status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed";
    }>();

  if (storeError) {
    throw new Error(storeError.message);
  }

  if (!store || !isStorePubliclyAccessibleStatus(store.status)) {
    await markStorefrontCheckoutFailed(checkout.id, "Store is no longer live. Checkout cannot be completed.", paymentIntentId);
    return { status: "failed" as const, orderId: null, errorMessage: "Store is no longer live. Checkout cannot be completed." };
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
      const fallbackFeeProfile = await resolveStoreFeeProfile(checkout.store_id);
      const feeProfile = resolveCheckoutFeeSnapshot(checkout, fallbackFeeProfile);
      const platformFeeCents =
        checkout.platform_fee_cents ??
        calculatePlatformFeeCents(computedTotalCents, feeProfile);

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
          analytics_session_id: checkout.analytics_session_id,
          analytics_session_key: checkout.analytics_session_key,
          source_cart_id: checkout.source_cart_id,
          storefront_checkout_session_id: checkout.id,
          shipping_fee_cents: shippingFeeCents,
          total_cents: computedTotalCents
        })
        .eq("id", existingOrder.id);

      if (orderSyncError) {
        throw new Error(orderSyncError.message);
      }

      if (checkout.source_cart_id) {
        await supabase.from("customer_carts").update({ status: "ordered" }).eq("id", checkout.source_cart_id);
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
        feeBaseCents: computedTotalCents,
        feeProfile,
        platformFeeCents,
        netPayoutCents: Math.max(0, computedTotalCents - platformFeeCents)
      });

      await sendOrderCreatedNotifications(existingOrder.id);

      return { status: "completed" as const, orderId: existingOrder.id };
    }
  }

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "stub_checkout_create_paid_order",
    buildStubCheckoutRpcPayload({
      storeSlug: checkout.store_slug,
      customerEmail: checkout.customer_email,
      customerUserId: await resolveCheckoutCustomerUserId(supabase, checkout.source_cart_id),
      items: checkout.items,
      stubPaymentRef: paymentIntentId,
      discountCents: 0,
      promoCode: checkout.promo_code
    })
  );

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
  const fallbackFeeProfile = await resolveStoreFeeProfile(checkout.store_id);
  const feeProfile = resolveCheckoutFeeSnapshot(checkout, fallbackFeeProfile);
  const platformFeeCents =
    checkout.platform_fee_cents ??
    calculatePlatformFeeCents(computedTotalCents, feeProfile);

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
      analytics_session_id: checkout.analytics_session_id,
      analytics_session_key: checkout.analytics_session_key,
      source_cart_id: checkout.source_cart_id,
      storefront_checkout_session_id: checkout.id,
      shipping_fee_cents: shippingFeeCents,
      total_cents: computedTotalCents
    })
    .eq("id", orderId);

  if (orderSyncError) {
    throw new Error(orderSyncError.message);
  }

  if (checkout.source_cart_id) {
    await supabase.from("customer_carts").update({ status: "ordered" }).eq("id", checkout.source_cart_id);
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
    feeBaseCents: computedTotalCents,
    feeProfile,
    platformFeeCents,
    netPayoutCents: Math.max(0, computedTotalCents - platformFeeCents)
  });

  await sendOrderCreatedNotifications(orderId);

  return { status: "completed" as const, orderId };
}

export async function expirePendingStorefrontCheckoutSessions(storeId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: sessions, error } = await supabase
    .from("storefront_checkout_sessions")
    .select("id,stripe_checkout_session_id")
    .eq("store_id", storeId)
    .eq("status", "pending")
    .not("stripe_checkout_session_id", "is", null)
    .returns<Array<{ id: string; stripe_checkout_session_id: string | null }>>();

  if (error) {
    throw new Error(error.message);
  }

  const validSessions = (sessions ?? []).filter((session) => session.stripe_checkout_session_id);
  if (validSessions.length === 0) {
    return;
  }

  if (!isStripeStubMode()) {
    const stripe = getStripeClient();
    await Promise.allSettled(
      validSessions.map((session) => stripe.checkout.sessions.expire(session.stripe_checkout_session_id!))
    );
  }

  await Promise.all(
    validSessions.map((session) =>
      supabase
        .from("storefront_checkout_sessions")
        .update({
          status: "failed",
          error_message: "Checkout session expired because the store is no longer live."
        })
        .eq("id", session.id)
        .eq("status", "pending")
    )
  );
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

export async function markStorefrontCheckoutFailed(checkoutId: string, errorMessage: string, paymentIntentId: string | null = null) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("storefront_checkout_sessions")
    .update({
      status: "failed",
      error_message: errorMessage,
      stripe_payment_intent_id: paymentIntentId
    })
    .eq("id", checkoutId)
    .eq("status", "pending");

  if (error) {
    throw new Error(error.message);
  }
}
