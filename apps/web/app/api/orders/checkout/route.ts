import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAppUrl, isStripeStubMode } from "@/lib/env";
import { calculatePlatformFeeCents, resolveStoreFeeProfile, writeOrderFeeBreakdown } from "@/lib/billing/fees";
import { sendOrderCreatedNotifications } from "@/lib/notifications/order-emails";
import { resolveEligiblePickupLocations } from "@/lib/pickup/distance";
import { buildPickupSlots } from "@/lib/pickup/scheduling";
import { formatVariantLabel } from "@/lib/products/variants";
import { calculateDiscountCents } from "@/lib/promotions/calculate-discount";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { resolveStoreSlugFromRequest } from "@/lib/stores/active-store";
import { getStripeClient } from "@/lib/stripe/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const itemSchema = z
  .object({
    productId: z.string().uuid().optional(),
    variantId: z.string().uuid().optional(),
    quantity: z.number().int().positive().max(99)
  })
  .refine((value) => Boolean(value.productId || value.variantId), {
    message: "Each item requires productId or variantId"
  });

const payloadSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(40).optional(),
  email: z.string().email(),
  buyerLatitude: z.number().min(-90).max(90).optional(),
  buyerLongitude: z.number().min(-180).max(180).optional(),
  fulfillmentMethod: z.enum(["pickup", "shipping"]).optional(),
  pickupLocationId: z.string().uuid().optional(),
  pickupWindowStartAt: z.string().datetime().optional(),
  pickupWindowEndAt: z.string().datetime().optional(),
  customerNote: z.string().trim().max(1200).optional(),
  promoCode: z.string().trim().min(3).max(40).optional(),
  items: z.array(itemSchema).min(1)
});

type VariantProductJoin = {
  id: string;
  title: string;
  status: string;
  store_id: string;
};

type VariantRow = {
  id: string;
  product_id: string;
  title: string | null;
  price_cents: number;
  inventory_qty: number;
  is_made_to_order: boolean;
  status: string;
  option_values: Record<string, string> | null;
  products: VariantProductJoin | VariantProductJoin[] | null;
};

function normalizeVariantProduct(product: VariantRow["products"]): VariantProductJoin | null {
  if (!product) {
    return null;
  }

  return Array.isArray(product) ? (product[0] ?? null) : product;
}

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);

  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const rateLimitResponse = checkRateLimit(request, {
    key: "checkout",
    limit: 20,
    windowMs: 60_000
  });

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const payload = payloadSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const {
    firstName,
    lastName,
    phone,
    email,
    buyerLatitude,
    buyerLongitude,
    fulfillmentMethod,
    pickupLocationId,
    pickupWindowStartAt,
    pickupWindowEndAt,
    customerNote,
    items,
    promoCode
  } = payload.data;
  const storeSlug = resolveStoreSlugFromRequest(request);

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id,name,slug,status,mode,stripe_account_id")
    .eq("slug", storeSlug)
    .eq("status", "active")
    .maybeSingle<{
      id: string;
      name: string;
      slug: string;
      status: string;
      mode: "sandbox" | "live";
      stripe_account_id: string | null;
    }>();

  if (storeError) {
    return NextResponse.json({ error: storeError.message }, { status: 500 });
  }

  if (!store) {
    return NextResponse.json({ error: "Store not found or inactive." }, { status: 404 });
  }

  const { data: billingProfile, error: billingProfileError } = await supabase
    .from("store_billing_profiles")
    .select("test_mode_enabled")
    .eq("store_id", store.id)
    .maybeSingle<{ test_mode_enabled: boolean }>();

  if (billingProfileError) {
    return NextResponse.json({ error: billingProfileError.message }, { status: 500 });
  }

  const { data: checkoutSettings, error: checkoutSettingsError } = await supabase
    .from("store_settings")
    .select(
      "checkout_enable_local_pickup,checkout_local_pickup_label,checkout_local_pickup_fee_cents,checkout_enable_flat_rate_shipping,checkout_flat_rate_shipping_label,checkout_flat_rate_shipping_fee_cents,checkout_allow_order_note"
    )
    .eq("store_id", store.id)
    .maybeSingle<{
      checkout_enable_local_pickup: boolean | null;
      checkout_local_pickup_label: string | null;
      checkout_local_pickup_fee_cents: number | null;
      checkout_enable_flat_rate_shipping: boolean | null;
      checkout_flat_rate_shipping_label: string | null;
      checkout_flat_rate_shipping_fee_cents: number | null;
      checkout_allow_order_note: boolean | null;
    }>();

  if (checkoutSettingsError) {
    return NextResponse.json({ error: checkoutSettingsError.message }, { status: 500 });
  }

  const { data: pickupSettings, error: pickupSettingsError } = await supabase
    .from("store_pickup_settings")
    .select("pickup_enabled,selection_mode,eligibility_radius_miles,lead_time_hours,slot_interval_minutes,show_pickup_times,timezone")
    .eq("store_id", store.id)
    .maybeSingle<{
      pickup_enabled: boolean;
      selection_mode: "buyer_select" | "hidden_nearest";
      eligibility_radius_miles: number;
      lead_time_hours: number;
      slot_interval_minutes: number;
      show_pickup_times: boolean;
      timezone: string;
    }>();

  if (pickupSettingsError) {
    return NextResponse.json({ error: pickupSettingsError.message }, { status: 500 });
  }

  const { data: pickupLocations, error: pickupLocationsError } = await supabase
    .from("pickup_locations")
    .select("id,name,address_line1,address_line2,city,state_region,postal_code,country_code,latitude,longitude,is_active")
    .eq("store_id", store.id)
    .eq("is_active", true)
    .returns<
      Array<{
        id: string;
        name: string;
        address_line1: string;
        address_line2: string | null;
        city: string;
        state_region: string;
        postal_code: string;
        country_code: string;
        latitude: number | null;
        longitude: number | null;
        is_active: boolean;
      }>
    >();

  if (pickupLocationsError) {
    return NextResponse.json({ error: pickupLocationsError.message }, { status: 500 });
  }

  const configuredFulfillmentOptions: Array<{ method: "pickup" | "shipping"; label: string; feeCents: number }> = [];
  if (checkoutSettings?.checkout_enable_local_pickup) {
    configuredFulfillmentOptions.push({
      method: "pickup",
      label: checkoutSettings.checkout_local_pickup_label?.trim() || "Local pickup",
      feeCents: Math.max(0, checkoutSettings.checkout_local_pickup_fee_cents ?? 0)
    });
  }
  if (checkoutSettings?.checkout_enable_flat_rate_shipping ?? true) {
    configuredFulfillmentOptions.push({
      method: "shipping",
      label: checkoutSettings?.checkout_flat_rate_shipping_label?.trim() || "Shipping",
      feeCents: Math.max(0, checkoutSettings?.checkout_flat_rate_shipping_fee_cents ?? 0)
    });
  }
  if (configuredFulfillmentOptions.length === 0) {
    configuredFulfillmentOptions.push({
      method: "shipping",
      label: "Shipping",
      feeCents: 0
    });
  }

  let selectedFulfillment = configuredFulfillmentOptions[0]!;
  if (configuredFulfillmentOptions.length > 1) {
    if (!fulfillmentMethod) {
      return NextResponse.json({ error: "Please choose how to receive your order." }, { status: 400 });
    }
    const matched = configuredFulfillmentOptions.find((option) => option.method === fulfillmentMethod);
    if (!matched) {
      return NextResponse.json({ error: "Selected fulfillment option is unavailable." }, { status: 400 });
    }
    selectedFulfillment = matched;
  } else if (fulfillmentMethod) {
    const matched = configuredFulfillmentOptions.find((option) => option.method === fulfillmentMethod);
    if (matched) {
      selectedFulfillment = matched;
    }
  }

  const normalizedCustomerNote = checkoutSettings?.checkout_allow_order_note ? customerNote?.trim() || null : null;
  const normalizedPhone = phone?.trim() || null;
  let resolvedPickupLocationId: string | null = null;
  let resolvedPickupLocationSnapshot: Record<string, unknown> | null = null;
  let resolvedPickupWindowStartAt: string | null = null;
  let resolvedPickupWindowEndAt: string | null = null;
  let resolvedPickupTimezone: string | null = null;

  if (selectedFulfillment.method === "pickup") {
    const buyerCoordinates =
      Number.isFinite(buyerLatitude) && Number.isFinite(buyerLongitude)
        ? {
            latitude: buyerLatitude as number,
            longitude: buyerLongitude as number
          }
        : null;

    if (!pickupSettings?.pickup_enabled) {
      return NextResponse.json({ error: "Pickup is unavailable for this store." }, { status: 400 });
    }

    const eligiblePickupLocations = resolveEligiblePickupLocations(
      buyerCoordinates,
      (pickupLocations ?? []).map((location) => ({
        id: location.id,
        name: location.name,
        latitude: location.latitude,
        longitude: location.longitude
      })),
      pickupSettings.eligibility_radius_miles
    );

    if (eligiblePickupLocations.length === 0) {
      return NextResponse.json(
        { error: `No pickup locations are available within ${pickupSettings.eligibility_radius_miles} miles.` },
        { status: 400 }
      );
    }

    resolvedPickupLocationId =
      pickupSettings.selection_mode === "hidden_nearest"
        ? eligiblePickupLocations[0]?.id ?? null
        : pickupLocationId && eligiblePickupLocations.some((location) => location.id === pickupLocationId)
          ? pickupLocationId
          : null;

    if (!resolvedPickupLocationId) {
      return NextResponse.json({ error: "Select a pickup location." }, { status: 400 });
    }

    const chosenLocation = (pickupLocations ?? []).find((location) => location.id === resolvedPickupLocationId);
    if (!chosenLocation) {
      return NextResponse.json({ error: "Selected pickup location is unavailable." }, { status: 400 });
    }

    resolvedPickupLocationSnapshot = {
      id: chosenLocation.id,
      name: chosenLocation.name,
      addressLine1: chosenLocation.address_line1,
      addressLine2: chosenLocation.address_line2,
      city: chosenLocation.city,
      stateRegion: chosenLocation.state_region,
      postalCode: chosenLocation.postal_code,
      countryCode: chosenLocation.country_code
    };

    const [{ data: pickupLocationHours, error: pickupLocationHoursError }, { data: pickupBlackouts, error: pickupBlackoutsError }] =
      await Promise.all([
        supabase
          .from("pickup_location_hours")
          .select("pickup_location_id,day_of_week,opens_at,closes_at")
          .eq("pickup_location_id", resolvedPickupLocationId)
          .returns<Array<{ pickup_location_id: string; day_of_week: number; opens_at: string; closes_at: string }>>(),
        supabase
          .from("pickup_blackout_dates")
          .select("pickup_location_id,starts_at,ends_at")
          .eq("store_id", store.id)
          .or(`pickup_location_id.is.null,pickup_location_id.eq.${resolvedPickupLocationId}`)
          .returns<Array<{ pickup_location_id: string | null; starts_at: string; ends_at: string }>>()
      ]);

    if (pickupLocationHoursError) {
      return NextResponse.json({ error: pickupLocationHoursError.message }, { status: 500 });
    }

    if (pickupBlackoutsError) {
      return NextResponse.json({ error: pickupBlackoutsError.message }, { status: 500 });
    }

    const dayHours = (pickupLocationHours ?? []).reduce<Record<number, Array<{ opensAt: string; closesAt: string }>>>((acc, entry) => {
      const bucket = acc[entry.day_of_week] ?? [];
      bucket.push({ opensAt: entry.opens_at, closesAt: entry.closes_at });
      acc[entry.day_of_week] = bucket;
      return acc;
    }, {});

    const validSlots = buildPickupSlots({
      now: new Date(),
      leadTimeHours: pickupSettings.lead_time_hours,
      slotIntervalMinutes:  pickupSettings.slot_interval_minutes,
      timezone: pickupSettings.timezone,
      dayHours,
      blackoutWindows: (pickupBlackouts ?? []).map((entry) => ({
        startsAt: new Date(entry.starts_at),
        endsAt: new Date(entry.ends_at)
      })),
      maxSlots: 300
    });

    if (pickupSettings.show_pickup_times && validSlots.length === 0) {
      return NextResponse.json({ error: "No pickup times are currently available for the selected location." }, { status: 400 });
    }

    if (pickupSettings.show_pickup_times && (!pickupWindowStartAt || !pickupWindowEndAt)) {
      return NextResponse.json({ error: "Select a pickup time window." }, { status: 400 });
    }

    if (!pickupSettings.show_pickup_times) {
      resolvedPickupWindowStartAt = null;
      resolvedPickupWindowEndAt = null;
    } else if (pickupWindowStartAt && pickupWindowEndAt) {
      const startAt = new Date(pickupWindowStartAt);
      const endAt = new Date(pickupWindowEndAt);
      if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || startAt >= endAt) {
        return NextResponse.json({ error: "Pickup window is invalid." }, { status: 400 });
      }

      const isValidSlot = validSlots.some((slot) => slot.startsAt === startAt.toISOString() && slot.endsAt === endAt.toISOString());
      if (!isValidSlot) {
        return NextResponse.json({ error: "Selected pickup time is no longer available. Please choose another slot." }, { status: 400 });
      }

      resolvedPickupWindowStartAt = startAt.toISOString();
      resolvedPickupWindowEndAt = endAt.toISOString();
    }

    resolvedPickupTimezone = pickupSettings.timezone;
  }

  const aggregatedVariantItems = new Map<string, { quantity: number; productId: string | null }>();
  const unresolvedProductItems = new Map<string, number>();

  for (const item of items) {
    if (item.variantId) {
      const current = aggregatedVariantItems.get(item.variantId) ?? { quantity: 0, productId: item.productId ?? null };
      aggregatedVariantItems.set(item.variantId, {
        quantity: current.quantity + item.quantity,
        productId: item.productId ?? current.productId
      });
      continue;
    }

    if (!item.productId) {
      return NextResponse.json({ error: "Each item requires a product or variant." }, { status: 400 });
    }

    unresolvedProductItems.set(item.productId, (unresolvedProductItems.get(item.productId) ?? 0) + item.quantity);
  }

  if (unresolvedProductItems.size > 0) {
    const unresolvedProductIds = [...unresolvedProductItems.keys()];

    const { data: fallbackVariants, error: fallbackVariantsError } = await supabase
      .from("product_variants")
      .select("id,product_id,is_default,sort_order,created_at,status")
      .eq("store_id", store.id)
      .in("product_id", unresolvedProductIds)
      .eq("status", "active")
      .returns<
        Array<{
          id: string;
          product_id: string;
          is_default: boolean;
          sort_order: number;
          created_at: string;
          status: "active" | "archived";
        }>
      >();

    if (fallbackVariantsError) {
      return NextResponse.json({ error: fallbackVariantsError.message }, { status: 500 });
    }

    const variantCandidatesByProduct = new Map<string, Array<(typeof fallbackVariants)[number]>>();

    for (const variant of fallbackVariants ?? []) {
      const bucket = variantCandidatesByProduct.get(variant.product_id) ?? [];
      bucket.push(variant);
      variantCandidatesByProduct.set(variant.product_id, bucket);
    }

    for (const [productId, quantity] of unresolvedProductItems.entries()) {
      const candidates = variantCandidatesByProduct.get(productId) ?? [];
      candidates.sort((left, right) => {
        if (left.is_default !== right.is_default) {
          return left.is_default ? -1 : 1;
        }

        if (left.sort_order !== right.sort_order) {
          return left.sort_order - right.sort_order;
        }

        return left.created_at.localeCompare(right.created_at);
      });

      const selectedVariant = candidates[0];

      if (!selectedVariant) {
        return NextResponse.json({ error: `Product ${productId} is unavailable.` }, { status: 400 });
      }

      const current = aggregatedVariantItems.get(selectedVariant.id) ?? { quantity: 0, productId };
      aggregatedVariantItems.set(selectedVariant.id, {
        quantity: current.quantity + quantity,
        productId
      });
    }
  }

  const variantIds = [...aggregatedVariantItems.keys()];

  if (variantIds.length === 0) {
    return NextResponse.json({ error: "Checkout requires at least one item." }, { status: 400 });
  }

  const { data: variants, error: variantsError } = await supabase
    .from("product_variants")
    .select("id,product_id,title,price_cents,inventory_qty,is_made_to_order,status,option_values,products!inner(id,title,status,store_id)")
    .eq("store_id", store.id)
    .in("id", variantIds)
    .returns<VariantRow[]>();

  if (variantsError) {
    return NextResponse.json({ error: variantsError.message }, { status: 500 });
  }

  const variantMap = new Map((variants ?? []).map((variant) => [variant.id, variant]));
  const rpcItems: Array<{ productId: string; variantId: string; quantity: number; variantLabel: string }> = [];
  let subtotalCents = 0;

  for (const [variantId, entry] of aggregatedVariantItems.entries()) {
    const variant = variantMap.get(variantId);

    if (!variant || variant.status !== "active") {
      return NextResponse.json({ error: `Selected variant ${variantId} is unavailable.` }, { status: 400 });
    }

    const product = normalizeVariantProduct(variant.products);

    if (!product || product.status !== "active") {
      return NextResponse.json({ error: "A selected product is unavailable." }, { status: 400 });
    }

    if (!variant.is_made_to_order && variant.inventory_qty < entry.quantity) {
      const label = formatVariantLabel({ title: variant.title, option_values: variant.option_values }, product.title);
      return NextResponse.json({ error: `Insufficient inventory for ${label}.` }, { status: 400 });
    }

    subtotalCents += variant.price_cents * entry.quantity;

    rpcItems.push({
      productId: product.id,
      variantId,
      quantity: entry.quantity,
      variantLabel: formatVariantLabel({ title: variant.title, option_values: variant.option_values }, product.title)
    });
  }

  let discountCents = 0;
  let normalizedPromoCode: string | null = null;

  if (promoCode?.trim()) {
    normalizedPromoCode = promoCode.trim().toUpperCase();

    const { data: promotion, error: promotionError } = await supabase
      .from("promotions")
      .select("code,discount_type,discount_value,min_subtotal_cents,max_redemptions,times_redeemed,starts_at,ends_at,is_active")
      .eq("store_id", store.id)
      .eq("code", normalizedPromoCode)
      .maybeSingle<{
        code: string;
        discount_type: "percent" | "fixed";
        discount_value: number;
        min_subtotal_cents: number;
        max_redemptions: number | null;
        times_redeemed: number;
        starts_at: string | null;
        ends_at: string | null;
        is_active: boolean;
      }>();

    if (promotionError) {
      return NextResponse.json({ error: promotionError.message }, { status: 500 });
    }

    if (!promotion || !promotion.is_active) {
      return NextResponse.json({ error: "Promo code is invalid or inactive." }, { status: 400 });
    }

    const now = Date.now();

    if (promotion.starts_at && new Date(promotion.starts_at).getTime() > now) {
      return NextResponse.json({ error: "Promo code is not active yet." }, { status: 400 });
    }

    if (promotion.ends_at && new Date(promotion.ends_at).getTime() < now) {
      return NextResponse.json({ error: "Promo code has expired." }, { status: 400 });
    }

    if (promotion.max_redemptions !== null && promotion.times_redeemed >= promotion.max_redemptions) {
      return NextResponse.json({ error: "Promo code redemption limit reached." }, { status: 400 });
    }

    if (subtotalCents < promotion.min_subtotal_cents) {
      return NextResponse.json(
        { error: `Promo requires minimum subtotal of $${(promotion.min_subtotal_cents / 100).toFixed(2)}.` },
        { status: 400 }
      );
    }

    discountCents = calculateDiscountCents(subtotalCents, promotion);
  }

  const itemTotalCents = Math.max(0, subtotalCents - discountCents);
  const shippingFeeCents = selectedFulfillment.feeCents;
  const totalCents = itemTotalCents + shippingFeeCents;
  const feeProfile = await resolveStoreFeeProfile(store.id);
  const platformFeeCents = calculatePlatformFeeCents(itemTotalCents, feeProfile);

  if (totalCents <= 0) {
    return NextResponse.json({ error: "Order total must be greater than $0.00." }, { status: 400 });
  }

  const shouldUseStubMode = isStripeStubMode() || store.mode === "sandbox" || Boolean(billingProfile?.test_mode_enabled);

  if (shouldUseStubMode) {
    const { data, error } = await supabase.rpc("stub_checkout_create_paid_order", {
      p_store_slug: storeSlug,
      p_customer_email: email,
      p_items: rpcItems,
      p_stub_payment_ref: `stub_pi_${Date.now()}`,
      p_promo_code: promoCode ? promoCode.toUpperCase() : null
    });

    if (error) {
      const message = error.message || "Unable to complete checkout.";
      if (message.includes("Store not found")) {
        return NextResponse.json({ error: message }, { status: 404 });
      }
      if (message.includes("Insufficient inventory") || message.includes("unavailable") || message.includes("Promo")) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result?.order_id) {
      return NextResponse.json({ error: "Checkout did not return an order id." }, { status: 500 });
    }

    const { data: orderBeforeUpdate, error: orderBeforeUpdateError } = await supabase
      .from("orders")
      .select("subtotal_cents,discount_cents")
      .eq("id", result.order_id)
      .single<{ subtotal_cents: number; discount_cents: number }>();

    if (orderBeforeUpdateError || !orderBeforeUpdate) {
      return NextResponse.json({ error: orderBeforeUpdateError?.message ?? "Unable to finalize order details." }, { status: 500 });
    }

    const computedTotalCents = Math.max(0, orderBeforeUpdate.subtotal_cents - orderBeforeUpdate.discount_cents) + shippingFeeCents;

    const { error: orderUpdateError } = await supabase
      .from("orders")
      .update({
        customer_first_name: firstName,
        customer_last_name: lastName,
        customer_phone: normalizedPhone,
        customer_note: normalizedCustomerNote,
        fulfillment_method: selectedFulfillment.method,
        fulfillment_label: selectedFulfillment.label,
        pickup_location_id: resolvedPickupLocationId,
        pickup_location_snapshot_json: resolvedPickupLocationSnapshot,
        pickup_window_start_at: resolvedPickupWindowStartAt,
        pickup_window_end_at: resolvedPickupWindowEndAt,
        pickup_timezone: resolvedPickupTimezone,
        shipping_fee_cents: shippingFeeCents,
        platform_fee_bps: feeProfile.feeBps,
        platform_fee_cents: platformFeeCents,
        total_cents: computedTotalCents
      })
      .eq("id", result.order_id);

    if (orderUpdateError) {
      return NextResponse.json({ error: orderUpdateError.message }, { status: 500 });
    }

    await writeOrderFeeBreakdown({
      orderId: result.order_id,
      storeId: store.id,
      subtotalCents: orderBeforeUpdate.subtotal_cents,
      feeProfile,
      platformFeeCents,
      netPayoutCents: Math.max(0, computedTotalCents - platformFeeCents)
    });

    await sendOrderCreatedNotifications(result.order_id);

    return NextResponse.json({
      orderId: result.order_id,
      status: "paid",
      totalCents: computedTotalCents,
      discountCents: result.discount_cents,
      promoCode: result.promo_code,
      paymentMode: "stub"
    });
  }

  if (!store.stripe_account_id) {
    return NextResponse.json({ error: "This store has not configured payments yet." }, { status: 400 });
  }

  const applicationFeeAmount = platformFeeCents;

  const { data: pendingCheckout, error: pendingCheckoutError } = await supabase
    .from("storefront_checkout_sessions")
    .insert({
      store_id: store.id,
      store_slug: store.slug,
      customer_email: email,
      customer_first_name: firstName,
      customer_last_name: lastName,
      customer_phone: normalizedPhone,
      customer_note: normalizedCustomerNote,
      fulfillment_method: selectedFulfillment.method,
      fulfillment_label: selectedFulfillment.label,
      shipping_fee_cents: shippingFeeCents,
      pickup_location_id: resolvedPickupLocationId,
      pickup_location_snapshot_json: resolvedPickupLocationSnapshot,
      pickup_window_start_at: resolvedPickupWindowStartAt,
      pickup_window_end_at: resolvedPickupWindowEndAt,
      pickup_timezone: resolvedPickupTimezone,
      promo_code: normalizedPromoCode,
      items: rpcItems,
      status: "pending"
    })
    .select("id")
    .single<{ id: string }>();

  if (pendingCheckoutError || !pendingCheckout) {
    return NextResponse.json({ error: pendingCheckoutError?.message ?? "Unable to create checkout session." }, { status: 500 });
  }

  const appUrl = getAppUrl();
  const stripe = getStripeClient();

  const paymentIntentData: {
    transfer_data: { destination: string };
    application_fee_amount?: number;
    metadata: Record<string, string>;
  } = {
    transfer_data: {
      destination: store.stripe_account_id
    },
    metadata: {
      checkout_kind: "storefront_order",
      storefront_checkout_id: pendingCheckout.id,
      store_id: store.id,
      store_slug: store.slug,
      pickup_location_id: resolvedPickupLocationId ?? "",
      pickup_window_start_at: resolvedPickupWindowStartAt ?? "",
      pickup_window_end_at: resolvedPickupWindowEndAt ?? ""
    }
  };

  if (applicationFeeAmount > 0) {
    paymentIntentData.application_fee_amount = applicationFeeAmount;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `${store.name} order` },
          unit_amount: totalCents
        },
        quantity: 1
      }
    ],
    success_url: `${appUrl}/checkout?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/checkout?status=cancelled`,
    metadata: {
      checkout_kind: "storefront_order",
      storefront_checkout_id: pendingCheckout.id,
      store_id: store.id,
      store_slug: store.slug,
      promo_code: normalizedPromoCode ?? "",
      pickup_location_id: resolvedPickupLocationId ?? "",
      pickup_window_start_at: resolvedPickupWindowStartAt ?? "",
      pickup_window_end_at: resolvedPickupWindowEndAt ?? ""
    },
    payment_intent_data: paymentIntentData
  });

  const { error: updateCheckoutError } = await supabase
    .from("storefront_checkout_sessions")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", pendingCheckout.id);

  if (updateCheckoutError) {
    return NextResponse.json({ error: updateCheckoutError.message }, { status: 500 });
  }

  return NextResponse.json({
    mode: "checkout",
    checkoutUrl: session.url,
    sessionId: session.id,
    paymentMode: "stripe"
  });
}
