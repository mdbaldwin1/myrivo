import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveStorefrontSessionLink } from "@/lib/analytics/session-linking";
import { getAppUrl, isStripeStubMode } from "@/lib/env";
import { calculatePlatformFeeCents, resolveStoreFeeProfile, writeOrderFeeBreakdown } from "@/lib/billing/fees";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { sendOrderCreatedNotifications } from "@/lib/notifications/order-emails";
import { resolveAvailablePickupLocations } from "@/lib/pickup/availability";
import { buildPickupSlots } from "@/lib/pickup/scheduling";
import { formatVariantLabel } from "@/lib/products/variants";
import { calculateDiscountCents } from "@/lib/promotions/calculate-discount";
import { normalizePromotionRedemptionEmail, PROMOTION_CUSTOMER_CAP_REACHED_ERROR } from "@/lib/promotions/redemption";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { resolveStoreSlugFromRequestAsync } from "@/lib/stores/active-store";
import { isStorePubliclyAccessibleStatus } from "@/lib/stores/lifecycle";
import { buildStorefrontCheckoutPath } from "@/lib/storefront/paths";
import { buildStubCheckoutRpcPayload } from "@/lib/storefront/stub-checkout";
import { getStoreStripePaymentsReadiness } from "@/lib/stripe/store-payments-readiness";
import { getStripeClient } from "@/lib/stripe/server";
import { isMissingColumnInSchemaCache } from "@/lib/supabase/error-classifiers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isStorePaymentsReadyForLaunch, type StoreTaxCollectionMode } from "@/lib/stores/tax-compliance";

const itemSchema = z
  .object({
    productId: z.string().uuid().optional(),
    variantId: z.string().uuid().optional(),
    quantity: z.number().int().positive().max(99)
  })
  .refine((value) => Boolean(value.productId || value.variantId), {
    message: "Each item requires productId or variantId"
  });

const attributionTouchSchema = z.object({
  entryPath: z.string().trim().max(512).optional(),
  referrerUrl: z.string().trim().max(1024).optional(),
  referrerHost: z.string().trim().max(255).optional(),
  utmSource: z.string().trim().max(255).optional(),
  utmMedium: z.string().trim().max(255).optional(),
  utmCampaign: z.string().trim().max(255).optional(),
  utmTerm: z.string().trim().max(255).optional(),
  utmContent: z.string().trim().max(255).optional()
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
  analyticsSessionId: z.string().trim().min(16).max(128).optional(),
  attribution: z
    .object({
      firstTouch: attributionTouchSchema.optional(),
      lastTouch: attributionTouchSchema.optional()
    })
    .optional(),
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

type StripeCheckoutLineSource = {
  productTitle: string;
  variantLabel: string;
  quantity: number;
  unitPriceCents: number;
};

type StripeCheckoutLineItem = {
  price_data: {
    currency: "usd";
    product_data: {
      name: string;
      description?: string;
    };
    unit_amount: number;
  };
  quantity: number;
};

function normalizeVariantProduct(product: VariantRow["products"]): VariantProductJoin | null {
  if (!product) {
    return null;
  }

  return Array.isArray(product) ? (product[0] ?? null) : product;
}

function allocateDiscountAcrossLineItems(items: StripeCheckoutLineSource[], discountCents: number) {
  if (discountCents <= 0 || items.length === 0) {
    return items.map((item) => ({ ...item, lineDiscountCents: 0 }));
  }

  const subtotalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
  if (subtotalCents <= 0) {
    return items.map((item) => ({ ...item, lineDiscountCents: 0 }));
  }

  const allocations = items.map((item, index) => {
    const lineSubtotalCents = item.unitPriceCents * item.quantity;
    const exactDiscount = (lineSubtotalCents * discountCents) / subtotalCents;
    const flooredDiscount = Math.floor(exactDiscount);

    return {
      index,
      lineSubtotalCents,
      fractionalRemainder: exactDiscount - flooredDiscount,
      lineDiscountCents: Math.min(lineSubtotalCents, flooredDiscount)
    };
  });

  let remainingDiscountCents = Math.min(
    discountCents,
    subtotalCents
  ) - allocations.reduce((sum, allocation) => sum + allocation.lineDiscountCents, 0);

  allocations.sort((left, right) => {
    if (right.fractionalRemainder !== left.fractionalRemainder) {
      return right.fractionalRemainder - left.fractionalRemainder;
    }
    return left.index - right.index;
  });

  while (remainingDiscountCents > 0) {
    let applied = false;

    for (const allocation of allocations) {
      if (allocation.lineDiscountCents >= allocation.lineSubtotalCents) {
        continue;
      }

      allocation.lineDiscountCents += 1;
      remainingDiscountCents -= 1;
      applied = true;

      if (remainingDiscountCents === 0) {
        break;
      }
    }

    if (!applied) {
      break;
    }
  }

  allocations.sort((left, right) => left.index - right.index);

  return items.map((item, index) => ({
    ...item,
    lineDiscountCents: allocations[index]?.lineDiscountCents ?? 0
  }));
}

function buildStripeCheckoutLineItems(items: StripeCheckoutLineSource[], discountCents: number): StripeCheckoutLineItem[] {
  const discountedItems = allocateDiscountAcrossLineItems(items, discountCents);
  const lineItems: StripeCheckoutLineItem[] = [];

  for (const item of discountedItems) {
    const adjustedLineTotalCents = Math.max(0, item.unitPriceCents * item.quantity - item.lineDiscountCents);
    const baseUnitAmountCents = Math.floor(adjustedLineTotalCents / item.quantity);
    const remainderUnits = adjustedLineTotalCents - baseUnitAmountCents * item.quantity;
    const description = item.variantLabel !== item.productTitle ? item.variantLabel : undefined;

    const pushLine = (unitAmountCents: number, quantity: number) => {
      if (quantity <= 0) {
        return;
      }

      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: item.productTitle,
            ...(description ? { description } : {})
          },
          unit_amount: unitAmountCents
        },
        quantity
      });
    };

    pushLine(baseUnitAmountCents, item.quantity - remainderUnits);
    pushLine(baseUnitAmountCents + 1, remainderUnits);
  }

  return lineItems;
}

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);

  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const rateLimitResponse = await checkRateLimit(request, {
    key: "checkout",
    limit: 20,
    windowMs: 60_000
  });

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const payload = await parseJsonRequest(request, payloadSchema);
  if (!payload.ok) {
    return payload.response;
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
    promoCode,
    analyticsSessionId,
    attribution
  } = payload.data;
  const storeSlug = await resolveStoreSlugFromRequestAsync(request);
  if (!storeSlug) {
    return NextResponse.json({ error: "Store context is required." }, { status: 400 });
  }

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id,name,slug,status,stripe_account_id")
    .eq("slug", storeSlug)
    .maybeSingle<{
      id: string;
      name: string;
      slug: string;
      status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed";
      stripe_account_id: string | null;
    }>();

  if (storeError) {
    return NextResponse.json({ error: storeError.message }, { status: 500 });
  }

  if (!store || !isStorePubliclyAccessibleStatus(store.status)) {
    return NextResponse.json({ error: "Store not found or inactive." }, { status: 404 });
  }

  const { data: taxDecision, error: taxDecisionError } = await supabase
    .from("stores")
    .select("tax_collection_mode")
    .eq("id", store.id)
    .maybeSingle<{ tax_collection_mode: StoreTaxCollectionMode }>();

  if (taxDecisionError && !isMissingColumnInSchemaCache(taxDecisionError, "tax_collection_mode")) {
    return NextResponse.json({ error: taxDecisionError.message }, { status: 500 });
  }

  const taxCollectionMode: StoreTaxCollectionMode = isMissingColumnInSchemaCache(taxDecisionError, "tax_collection_mode")
    ? "unconfigured"
    : (taxDecision?.tax_collection_mode ?? "unconfigured");

  const sessionLink = await resolveStorefrontSessionLink(supabase, {
    storeId: store.id,
    sessionKey: analyticsSessionId
  });

  const serverSupabase = await createSupabaseServerClient();
  const {
    data: { user: authenticatedUser }
  } = await serverSupabase.auth.getUser();

  let sourceCartId: string | null = null;
  if (authenticatedUser) {
    const { data: activeCart } = await serverSupabase
      .from("customer_carts")
      .select("id")
      .eq("user_id", authenticatedUser.id)
      .eq("store_id", store.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();

    sourceCartId = activeCart?.id ?? null;
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
    .select(
      "pickup_enabled,selection_mode,geolocation_fallback_mode,out_of_radius_behavior,eligibility_radius_miles,lead_time_hours,slot_interval_minutes,show_pickup_times,timezone"
    )
    .eq("store_id", store.id)
    .maybeSingle<{
      pickup_enabled: boolean;
      selection_mode: "buyer_select" | "hidden_nearest";
      geolocation_fallback_mode: "allow_without_distance" | "disable_pickup";
      out_of_radius_behavior: "disable_pickup" | "allow_all_locations";
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

    const normalizedPickupLocations = (pickupLocations ?? []).map((location) => ({
      id: location.id,
      name: location.name,
      latitude: location.latitude,
      longitude: location.longitude
    }));
    const availablePickupLocations = resolveAvailablePickupLocations({
      buyer: buyerCoordinates,
      locations: normalizedPickupLocations,
      radiusMiles: pickupSettings.eligibility_radius_miles,
      geolocationFallbackMode: pickupSettings.geolocation_fallback_mode,
      outOfRadiusBehavior: pickupSettings.out_of_radius_behavior
    });

    if (availablePickupLocations.length === 0) {
      const reason = buyerCoordinates
        ? `No pickup locations are available within ${pickupSettings.eligibility_radius_miles} miles.`
        : "Enable location access to verify pickup availability.";
      return NextResponse.json(
        { error: reason },
        { status: 400 }
      );
    }

    resolvedPickupLocationId =
      pickupSettings.selection_mode === "hidden_nearest"
        ? availablePickupLocations[0]?.id ?? null
        : pickupLocationId && availablePickupLocations.some((location) => location.id === pickupLocationId)
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
  const rpcItems: Array<{ productId: string; variantId: string; quantity: number; variantLabel: string; productTitle: string; unitPriceCents: number }> = [];
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

    const variantLabel = formatVariantLabel({ title: variant.title, option_values: variant.option_values }, product.title);

    rpcItems.push({
      productId: product.id,
      variantId,
      quantity: entry.quantity,
      variantLabel,
      productTitle: product.title,
      unitPriceCents: variant.price_cents
    });
  }

  let discountCents = 0;
  let normalizedPromoCode: string | null = null;
  const normalizedCustomerEmail = normalizePromotionRedemptionEmail(email);

  if (promoCode?.trim()) {
    normalizedPromoCode = promoCode.trim().toUpperCase();

    const { data: promotion, error: promotionError } = await supabase
      .from("promotions")
      .select("id,code,discount_type,discount_value,min_subtotal_cents,max_redemptions,per_customer_redemption_limit,times_redeemed,starts_at,ends_at,is_active")
      .eq("store_id", store.id)
      .eq("code", normalizedPromoCode)
      .maybeSingle<{
        id: string;
        code: string;
        discount_type: "percent" | "fixed";
        discount_value: number;
        min_subtotal_cents: number;
        max_redemptions: number | null;
        per_customer_redemption_limit: number | null;
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

    if (promotion.per_customer_redemption_limit !== null) {
      const redemptionIds = new Set<string>();

      const { data: emailRedemptions, error: emailRedemptionsError } = await supabase
        .from("promotion_redemptions")
        .select("id")
        .eq("promotion_id", promotion.id)
        .eq("customer_email_normalized", normalizedCustomerEmail)
        .returns<Array<{ id: string }>>();

      if (emailRedemptionsError) {
        return NextResponse.json({ error: emailRedemptionsError.message }, { status: 500 });
      }

      for (const redemption of emailRedemptions ?? []) {
        redemptionIds.add(redemption.id);
      }

      if (authenticatedUser?.id) {
        const { data: userRedemptions, error: userRedemptionsError } = await supabase
          .from("promotion_redemptions")
          .select("id")
          .eq("promotion_id", promotion.id)
          .eq("customer_user_id", authenticatedUser.id)
          .returns<Array<{ id: string }>>();

        if (userRedemptionsError) {
          return NextResponse.json({ error: userRedemptionsError.message }, { status: 500 });
        }

        for (const redemption of userRedemptions ?? []) {
          redemptionIds.add(redemption.id);
        }
      }

      if (redemptionIds.size >= promotion.per_customer_redemption_limit) {
        return NextResponse.json({ error: PROMOTION_CUSTOMER_CAP_REACHED_ERROR }, { status: 400 });
      }
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
  const platformFeeCents = calculatePlatformFeeCents(totalCents, feeProfile);

  if (totalCents <= 0) {
    return NextResponse.json({ error: "Order total must be greater than $0.00." }, { status: 400 });
  }

  const shouldUseStubMode = isStripeStubMode();

  if (shouldUseStubMode) {
    const { data, error } = await supabase.rpc(
      "stub_checkout_create_paid_order",
      buildStubCheckoutRpcPayload({
        storeSlug,
        customerEmail: email,
        customerUserId: authenticatedUser?.id ?? null,
        items: rpcItems,
        stubPaymentRef: `stub_pi_${Date.now()}`,
        discountCents,
        promoCode: promoCode ? promoCode.toUpperCase() : null
      })
    );

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
        total_cents: computedTotalCents
      })
      .eq("id", result.order_id);

    if (orderUpdateError) {
      return NextResponse.json({ error: orderUpdateError.message }, { status: 500 });
    }

    await writeOrderFeeBreakdown({
      orderId: result.order_id,
      storeId: store.id,
      feeBaseCents: computedTotalCents,
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
  const stripeReadiness = await getStoreStripePaymentsReadiness(store.stripe_account_id);

  if (!isStorePaymentsReadyForLaunch(taxCollectionMode, stripeReadiness)) {
    if (taxCollectionMode === "unconfigured") {
      return NextResponse.json({ error: "This store's tax handling choice is not complete yet." }, { status: 409 });
    }

    if (taxCollectionMode === "stripe_tax" && stripeReadiness.taxSettingsStatus && stripeReadiness.taxSettingsStatus !== "active") {
      return NextResponse.json({ error: "This store's Stripe tax setup is not complete yet." }, { status: 409 });
    }

    return NextResponse.json({ error: "This store's Stripe account is not ready to accept live payments yet." }, { status: 409 });
  }

  const stripe = getStripeClient();

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
      analytics_session_key: sessionLink?.sessionKey ?? null,
      analytics_session_id: sessionLink?.id ?? null,
      source_cart_id: sourceCartId,
      fee_plan_key: feeProfile.planKey,
      fee_bps: feeProfile.feeBps,
      fee_fixed_cents: feeProfile.feeFixedCents,
      item_total_cents: itemTotalCents,
      platform_fee_cents: platformFeeCents,
      attribution_json: attribution ?? {},
      items: rpcItems,
      status: "pending"
    })
    .select("id")
    .single<{ id: string }>();

  if (pendingCheckoutError || !pendingCheckout) {
    return NextResponse.json({ error: pendingCheckoutError?.message ?? "Unable to create checkout session." }, { status: 500 });
  }

  const appUrl = getAppUrl();

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

  let sessionId: string | null = null;
  let sessionUrl: string | null = null;
  const stripeLineItems = buildStripeCheckoutLineItems(
    rpcItems.map((item) => ({
      productTitle: item.productTitle,
      variantLabel: item.variantLabel,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents
    })),
    discountCents
  );

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      ...(taxCollectionMode === "stripe_tax"
        ? {
            automatic_tax: {
              enabled: true,
              liability: {
                type: "account",
                account: store.stripe_account_id
              }
            }
          }
        : {}),
      billing_address_collection: "auto",
      ...(selectedFulfillment.method === "shipping"
        ? {
            shipping_address_collection: {
              allowed_countries: ["US"]
            }
          }
        : {}),
      line_items: stripeLineItems,
      ...(selectedFulfillment.method === "shipping"
        ? {
            shipping_options: [
              {
                shipping_rate_data: {
                  display_name: selectedFulfillment.label,
                  type: "fixed_amount",
                  fixed_amount: {
                    amount: shippingFeeCents,
                    currency: "usd"
                  }
                }
              }
            ]
          }
        : {}),
      success_url: `${appUrl}${buildStorefrontCheckoutPath(store.slug)}?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}${buildStorefrontCheckoutPath(store.slug)}?status=cancelled`,
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

    sessionId = session.id;
    sessionUrl = session.url;
  } catch (error) {
    await supabase
      .from("storefront_checkout_sessions")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Stripe checkout session creation failed."
      })
      .eq("id", pendingCheckout.id);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create Stripe checkout session." },
      { status: 502 }
    );
  }

  if (!sessionId || !sessionUrl) {
    await supabase
      .from("storefront_checkout_sessions")
      .update({
        status: "failed",
        error_message: "Stripe checkout session did not return required session data."
      })
      .eq("id", pendingCheckout.id);

    return NextResponse.json({ error: "Unable to create Stripe checkout session." }, { status: 502 });
  }

  const { error: updateCheckoutError } = await supabase
    .from("storefront_checkout_sessions")
    .update({ stripe_checkout_session_id: sessionId })
    .eq("id", pendingCheckout.id);

  if (updateCheckoutError) {
    await supabase
      .from("storefront_checkout_sessions")
      .update({ status: "failed", error_message: updateCheckoutError.message })
      .eq("id", pendingCheckout.id);
    return NextResponse.json({ error: updateCheckoutError.message }, { status: 500 });
  }

  return NextResponse.json({
    mode: "checkout",
    checkoutUrl: sessionUrl,
    sessionId,
    paymentMode: "stripe"
  });
}
