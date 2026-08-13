import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveStorefrontSessionLink } from "@/lib/analytics/session-linking";
import { getAppUrl, isStripeStubMode } from "@/lib/env";
import { calculatePlatformFeeCents, resolveStoreFeeProfile } from "@/lib/billing/fees";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { sendOrderCreatedNotifications } from "@/lib/notifications/order-emails";
import { resolveAvailablePickupLocations } from "@/lib/pickup/availability";
import { buildPickupSlots } from "@/lib/pickup/scheduling";
import { formatVariantLabel } from "@/lib/products/variants";
import {
  applyPromotionSequence,
  normalizeRequestedPromoCodes,
  type AppliedPromotionSummary,
  type PromotionApplicationRecord
} from "@/lib/promotions/apply-promotions";
import { normalizePromotionRedemptionEmail, PROMOTION_CUSTOMER_CAP_REACHED_ERROR } from "@/lib/promotions/redemption";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { resolveStoreSlugFromRequestAsync } from "@/lib/stores/active-store";
import { isStorePubliclyAccessibleStatus } from "@/lib/stores/lifecycle";
import { buildStorefrontCheckoutPath } from "@/lib/storefront/paths";
import { resolveCheckoutAttemptIdentity } from "@/lib/storefront/checkout-attempt-identity";
import {
  buildStubCheckoutWithManifestRpcPayload
} from "@/lib/storefront/stub-checkout";
import { getStoreStripePaymentsReadiness } from "@/lib/stripe/store-payments-readiness";
import { getStripeClient } from "@/lib/stripe/server";
import { isMissingColumnInSchemaCache } from "@/lib/supabase/error-classifiers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isStorePaymentsReadyForLaunch, type StoreTaxCollectionMode } from "@/lib/stores/tax-compliance";
import { issueDigitalEntitlements } from "@/lib/digital-products/entitlements";
import { DIGITAL_PRODUCT_CONFIG } from "@/lib/digital-products/config";
import {
  buildDigitalManifestStripeMetadata,
  createOrReuseCheckoutManifest,
  DigitalPurchaseManifestError
} from "@/lib/digital-products/manifest-service";

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
  checkoutAttemptId: z.string().uuid().optional(),
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  phone: z.string().trim().max(40).optional().default(""),
  email: z.string().email("A valid email address is required"),
  buyerLatitude: z.number().min(-90).max(90).optional(),
  buyerLongitude: z.number().min(-180).max(180).optional(),
  fulfillmentMethod: z.enum(["pickup", "shipping"]).optional(),
  digitalDeliveryConsent: z.boolean().optional().default(false),
  pickupLocationId: z.string().uuid().optional(),
  pickupWindowStartAt: z.string().datetime().optional(),
  pickupWindowEndAt: z.string().datetime().optional(),
  customerNote: z.string().trim().max(1200).optional(),
  promoCode: z.string().trim().min(3).max(40).optional(),
  promoCodes: z.array(z.string().trim().min(3).max(40)).max(10).optional(),
  analyticsSessionId: z.string().trim().min(16).max(128).optional(),
  attribution: z
    .object({
      firstTouch: attributionTouchSchema.optional(),
      lastTouch: attributionTouchSchema.optional()
    })
    .optional(),
  items: z.array(itemSchema).min(1)
});

const LEGACY_ORDERED_CART_RECOVERY_LIMIT = 100;

type VariantProductJoin = {
  id: string;
  title: string;
  status: string;
  store_id: string;
  product_type: "physical" | "digital";
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

type CheckoutSnapshotItem = StripeCheckoutLineSource & {
  productId: string;
  variantId: string;
  productType: "physical" | "digital";
};

type CheckoutAttemptRow = {
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
  shipping_fee_cents: number;
  pickup_location_id: string | null;
  pickup_location_snapshot_json: Record<string, unknown> | null;
  pickup_window_start_at: string | null;
  pickup_window_end_at: string | null;
  pickup_timezone: string | null;
  promo_code: string | null;
  promo_codes_json: string[];
  applied_promotions_json: AppliedPromotionSummary[];
  analytics_session_key: string | null;
  analytics_session_id: string | null;
  source_cart_id: string | null;
  fee_plan_key: string | null;
  fee_bps: number | null;
  fee_fixed_cents: number | null;
  item_total_cents: number | null;
  platform_fee_cents: number | null;
  attribution_json: Record<string, unknown>;
  items: CheckoutSnapshotItem[];
  digital_consent_version: string | null;
  digital_consent_accepted_at: string | null;
  digital_license_version: string | null;
  digital_manifest_id: string | null;
  checkout_mode: "stripe" | "stub" | null;
  stripe_account_id_snapshot: string | null;
  tax_collection_mode_snapshot: StoreTaxCollectionMode | null;
  status: "pending" | "completed" | "failed";
  order_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_checkout_url: string | null;
  checkout_attempt_key: string;
  checkout_request_fingerprint_sha256: string;
  created: boolean;
};

type CheckoutAdminClient = ReturnType<typeof createSupabaseAdminClient>;

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

async function createDigitalManifestForCheckout(checkout: CheckoutAttemptRow) {
  if (!checkout.digital_consent_accepted_at) {
    return null;
  }

  return createOrReuseCheckoutManifest({
    checkoutSessionId: checkout.id,
    storeId: checkout.store_id,
    items: checkout.items,
    consent: {
      version: checkout.digital_consent_version ?? DIGITAL_PRODUCT_CONFIG.consentVersion,
      acceptedAt: checkout.digital_consent_accepted_at
    }
  });
}

async function markManifestFailure(
  supabase: CheckoutAdminClient,
  checkout: CheckoutAttemptRow,
  error: unknown
) {
  await supabase
    .from("storefront_checkout_sessions")
    .update({ status: "failed", error_message: "Digital files were not ready for checkout." })
    .eq("id", checkout.id);

  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Digital files are not ready for checkout." },
    { status: error instanceof DigitalPurchaseManifestError ? 409 : 500 }
  );
}

async function resumeStubCheckout(
  supabase: CheckoutAdminClient,
  checkout: CheckoutAttemptRow
) {
  if (checkout.status === "failed") {
    return NextResponse.json(
      { error: "This checkout attempt can no longer be used. Please try checkout again." },
      { status: 409 }
    );
  }

  const hasDigitalItems = checkout.items.some((item) => item.productType === "digital");
  let manifestId = checkout.digital_manifest_id;
  if (hasDigitalItems && !manifestId) {
    try {
      manifestId = (await createDigitalManifestForCheckout(checkout))?.manifestId ?? null;
    } catch (error) {
      return markManifestFailure(supabase, checkout, error);
    }
  }

  const subtotalCents = checkout.items.reduce(
    (sum, item) => sum + item.unitPriceCents * item.quantity,
    0
  );
  const discountCents = Math.max(0, subtotalCents - (checkout.item_total_cents ?? subtotalCents));
  const stubPaymentRef = `stub_pi_${checkout.id.replaceAll("-", "")}`;
  const { data, error } = await supabase.rpc(
    "stub_checkout_create_paid_order_with_manifest",
    buildStubCheckoutWithManifestRpcPayload({
      storeSlug: checkout.store_slug,
      customerEmail: checkout.customer_email,
      customerUserId: null,
      items: checkout.items,
      stubPaymentRef,
      discountCents,
      promoCode: checkout.promo_code,
      checkoutSessionId: checkout.id,
      digitalManifestId: manifestId
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

  await sendOrderCreatedNotifications(result.order_id);
  await issueDigitalEntitlements(result.order_id);

  return NextResponse.json({
    orderId: result.order_id,
    status: "paid",
    totalCents: result.total_cents,
    discountCents: result.discount_cents,
    promoCode: result.promo_code,
    paymentMode: "stub"
  });
}

async function resumeStripeCheckout(
  supabase: CheckoutAdminClient,
  checkout: CheckoutAttemptRow
) {
  if (checkout.status === "completed" && checkout.order_id) {
    return NextResponse.json({
      orderId: checkout.order_id,
      status: "paid",
      paymentMode: "stripe"
    });
  }
  if (checkout.status !== "pending") {
    return NextResponse.json(
      { error: "This checkout attempt can no longer be used. Please try checkout again." },
      { status: 409 }
    );
  }
  if (checkout.stripe_checkout_session_id && checkout.stripe_checkout_url) {
    return NextResponse.json({
      mode: "checkout",
      checkoutUrl: checkout.stripe_checkout_url,
      sessionId: checkout.stripe_checkout_session_id,
      paymentMode: "stripe"
    });
  }
  if (!checkout.stripe_account_id_snapshot) {
    return NextResponse.json({ error: "This checkout attempt is missing its payment configuration." }, { status: 409 });
  }

  const checkoutHasDigitalItems = checkout.items.some((item) => item.productType === "digital");
  const checkoutHasPhysicalItems = checkout.items.some((item) => item.productType !== "digital");
  const checkoutSubtotalCents = checkout.items.reduce(
    (sum, item) => sum + item.unitPriceCents * item.quantity,
    0
  );
  const checkoutDiscountCents = Math.max(
    0,
    checkoutSubtotalCents - (checkout.item_total_cents ?? checkoutSubtotalCents)
  );
  let digitalManifestId = checkout.digital_manifest_id;
  if (checkoutHasDigitalItems && !digitalManifestId) {
    try {
      digitalManifestId = (await createDigitalManifestForCheckout(checkout))?.manifestId ?? null;
    } catch (error) {
      return markManifestFailure(supabase, checkout, error);
    }
  }

  const digitalManifestMetadata = digitalManifestId
    ? buildDigitalManifestStripeMetadata(digitalManifestId)
    : {};
  const stripeAccountId = checkout.stripe_account_id_snapshot;
  const metadata = {
    checkout_kind: "storefront_order",
    storefront_checkout_id: checkout.id,
    store_id: checkout.store_id,
    store_slug: checkout.store_slug,
    promo_codes: checkout.promo_codes_json.join(","),
    pickup_location_id: checkout.pickup_location_id ?? "",
    pickup_window_start_at: checkout.pickup_window_start_at ?? "",
    pickup_window_end_at: checkout.pickup_window_end_at ?? "",
    ...digitalManifestMetadata
  };
  const paymentIntentData: {
    transfer_data: { destination: string };
    application_fee_amount?: number;
    metadata: Record<string, string>;
  } = {
    transfer_data: { destination: stripeAccountId },
    metadata
  };
  if ((checkout.platform_fee_cents ?? 0) > 0) {
    paymentIntentData.application_fee_amount = checkout.platform_fee_cents ?? 0;
  }

  let sessionId: string | null = null;
  let sessionUrl: string | null = null;
  try {
    const session = await getStripeClient().checkout.sessions.create({
      mode: "payment",
      customer_email: checkout.customer_email,
      ...(checkout.tax_collection_mode_snapshot === "stripe_tax"
        ? {
            automatic_tax: {
              enabled: true,
              liability: { type: "account" as const, account: stripeAccountId }
            }
          }
        : {}),
      billing_address_collection: "auto",
      ...(checkoutHasPhysicalItems && checkout.fulfillment_method === "shipping"
        ? { shipping_address_collection: { allowed_countries: ["US" as const] } }
        : {}),
      line_items: buildStripeCheckoutLineItems(checkout.items, checkoutDiscountCents),
      ...(checkoutHasPhysicalItems && checkout.fulfillment_method === "shipping"
        ? {
            shipping_options: [{
              shipping_rate_data: {
                display_name: checkout.fulfillment_label ?? "Shipping",
                type: "fixed_amount" as const,
                fixed_amount: { amount: checkout.shipping_fee_cents, currency: "usd" }
              }
            }]
          }
        : {}),
      success_url: `${getAppUrl()}${buildStorefrontCheckoutPath(checkout.store_slug)}?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getAppUrl()}${buildStorefrontCheckoutPath(checkout.store_slug)}?status=cancelled`,
      metadata: { ...metadata, promo_code: checkout.promo_code ?? "" },
      payment_intent_data: paymentIntentData
    }, {
      idempotencyKey: `storefront-checkout:${checkout.id}`
    });
    sessionId = session.id;
    sessionUrl = session.url;
  } catch (error) {
    await supabase
      .from("storefront_checkout_sessions")
      .update({ error_message: error instanceof Error ? error.message : "Stripe checkout session creation failed." })
      .eq("id", checkout.id);
    return NextResponse.json(
      { error: "We could not confirm checkout yet. Please try again; you will not be charged twice." },
      { status: 503, headers: { "Retry-After": "2" } }
    );
  }

  if (!sessionId) {
    await supabase
      .from("storefront_checkout_sessions")
      .update({ error_message: "Stripe checkout session did not return a session id." })
      .eq("id", checkout.id);
    return NextResponse.json(
      { error: "We could not confirm checkout yet. Please try again; you will not be charged twice." },
      { status: 503, headers: { "Retry-After": "2" } }
    );
  }

  const { error } = await supabase.rpc("bind_storefront_checkout_stripe_session", {
    p_checkout_session_id: checkout.id,
    p_store_id: checkout.store_id,
    p_stripe_checkout_session_id: sessionId,
    p_stripe_checkout_url: sessionUrl
  });
  if (error) {
    return NextResponse.json(
      { error: "Checkout was created, but we could not confirm it yet. Please try again; you will not be charged twice." },
      { status: 503, headers: { "Retry-After": "2" } }
    );
  }

  if (!sessionUrl) {
    await supabase
      .from("storefront_checkout_sessions")
      .update({ error_message: "Stripe checkout session is accepted but its redirect URL is not available yet." })
      .eq("id", checkout.id);
    return NextResponse.json(
      { error: "We could not confirm checkout yet. Please try again; you will not be charged twice." },
      { status: 503, headers: { "Retry-After": "2" } }
    );
  }

  return NextResponse.json({
    mode: "checkout",
    checkoutUrl: sessionUrl,
    sessionId,
    paymentMode: "stripe"
  });
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
    checkoutAttemptId,
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
    promoCodes,
    analyticsSessionId,
    attribution,
    digitalDeliveryConsent
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

  if (!store) {
    return NextResponse.json({ error: "Store not found or inactive." }, { status: 404 });
  }

  const serverSupabase = await createSupabaseServerClient();
  const {
    data: { user: authenticatedUser }
  } = await serverSupabase.auth.getUser();

  let isStoreTeamMember = false;
  if (!isStorePubliclyAccessibleStatus(store.status)) {
    if (authenticatedUser) {
      const adminClient = createSupabaseAdminClient();
      const isOwner = store.id && authenticatedUser.id
        ? await adminClient
            .from("stores")
            .select("id")
            .eq("id", store.id)
            .eq("owner_user_id", authenticatedUser.id)
            .maybeSingle()
            .then(({ data }) => Boolean(data))
        : false;

      if (!isOwner) {
        const { data: membership } = await adminClient
          .from("store_memberships")
          .select("role")
          .eq("store_id", store.id)
          .eq("user_id", authenticatedUser.id)
          .eq("status", "active")
          .maybeSingle<{ role: string }>();

        isStoreTeamMember = Boolean(membership && ["owner", "admin", "staff"].includes(membership.role));
      } else {
        isStoreTeamMember = true;
      }
    }

    if (!isStoreTeamMember) {
      return NextResponse.json({ error: "Store not found or inactive." }, { status: 404 });
    }
  }

  const findCustomerCarts = async (status: "active" | "ordered") => {
    if (!authenticatedUser) {
      return {
        carts: [] as Array<{ id: string; status: "active" | "ordered" }>,
        error: null,
        exhaustive: true
      };
    }
    const candidateLimit = status === "active" ? 1 : LEGACY_ORDERED_CART_RECOVERY_LIMIT;
    const { data: carts, error, count } = await serverSupabase
      .from("customer_carts")
      .select("id,status", { count: "exact" })
      .eq("user_id", authenticatedUser.id)
      .eq("store_id", store.id)
      .eq("status", status)
      .order(status === "active" ? "created_at" : "updated_at", { ascending: false })
      .limit(candidateLimit + 1)
      .returns<Array<{ id: string; status: "active" | "ordered" }>>();

    const resolvedCarts = carts ?? [];
    const hasExactCandidateCount =
      typeof count === "number" &&
      Number.isFinite(count) &&
      Number.isSafeInteger(count) &&
      count >= 0;
    return {
      carts: resolvedCarts,
      error,
      exhaustive:
        hasExactCandidateCount &&
        count === resolvedCarts.length &&
        count <= candidateLimit
    };
  };
  const checkoutIntent = {
    firstName,
    lastName,
    phone: phone.trim(),
    email: email.trim().toLowerCase(),
    buyerLatitude: buyerLatitude ?? null,
    buyerLongitude: buyerLongitude ?? null,
    fulfillmentMethod: fulfillmentMethod ?? null,
    digitalDeliveryConsent,
    pickupLocationId: pickupLocationId ?? null,
    pickupWindowStartAt: pickupWindowStartAt ?? null,
    pickupWindowEndAt: pickupWindowEndAt ?? null,
    customerNote: customerNote?.trim() || null,
    promoCode: promoCode?.trim().toUpperCase() || null,
    promoCodes: promoCodes?.map((code) => code.trim().toUpperCase()) ?? [],
    items
  };
  const resolveIdentity = (cartId: string | null) => resolveCheckoutAttemptIdentity({
    checkoutAttemptId,
    storeId: store.id,
    customerEmail: email,
    sourceCartId: cartId,
    intent: checkoutIntent
  });
  const getExistingCheckout = async (identity: ReturnType<typeof resolveCheckoutAttemptIdentity>) => {
    const result = await supabase.rpc("get_storefront_checkout_attempt", {
      p_store_id: store.id,
      p_checkout_attempt_key: identity.attemptKey,
      p_request_fingerprint_sha256: identity.fingerprintSha256
    });
    return {
      checkout: result.data as CheckoutAttemptRow | null,
      error: result.error
    };
  };

  let sourceCartId: string | null = null;
  let checkoutAttemptIdentity: ReturnType<typeof resolveCheckoutAttemptIdentity>;
  let existingCheckout: CheckoutAttemptRow | null = null;

  if (!checkoutAttemptId && authenticatedUser) {
    const [activeCartResult, orderedCartResult] = await Promise.all([
      findCustomerCarts("active"),
      findCustomerCarts("ordered")
    ]);
    const cartLookupError = activeCartResult.error ?? orderedCartResult.error;
    if (cartLookupError) {
      return NextResponse.json({ error: cartLookupError.message }, { status: 500 });
    }
    if (!activeCartResult.exhaustive || !orderedCartResult.exhaustive) {
      return NextResponse.json(
        { error: "We could not safely identify which checkout to resume. Please refresh your cart and try again." },
        { status: 409 }
      );
    }

    const matchingAttempts: Array<{
      cartId: string;
      identity: ReturnType<typeof resolveCheckoutAttemptIdentity>;
      checkout: CheckoutAttemptRow;
    }> = [];
    const candidateCarts = [...new Map(
      [...activeCartResult.carts, ...orderedCartResult.carts].map((cart) => [cart.id, cart])
    ).values()];
    for (const cart of candidateCarts) {
      const identity = resolveIdentity(cart.id);
      const lookup = await getExistingCheckout(identity);
      if (lookup.error) {
        const fingerprintConflict = lookup.error.message?.includes("different purchase details");
        return NextResponse.json(
          { error: fingerprintConflict ? "This checkout attempt does not match the original purchase." : "Unable to resume checkout." },
          { status: fingerprintConflict ? 409 : 500 }
        );
      }
      if (lookup.checkout) {
        matchingAttempts.push({ cartId: cart.id, identity, checkout: lookup.checkout });
      }
    }

    if (matchingAttempts.length > 1) {
      return NextResponse.json(
        { error: "We could not safely identify which checkout to resume. Please refresh your cart and try again." },
        { status: 409 }
      );
    }

    if (matchingAttempts.length === 1) {
      const match = matchingAttempts[0]!;
      sourceCartId = match.cartId;
      checkoutAttemptIdentity = match.identity;
      existingCheckout = match.checkout;
    } else if (activeCartResult.carts.length === 1 && orderedCartResult.carts.length === 0) {
      sourceCartId = activeCartResult.carts[0]!.id;
      checkoutAttemptIdentity = resolveIdentity(sourceCartId);
    } else {
      return NextResponse.json(
        { error: "We could not safely start this checkout. Please refresh your cart and try again." },
        { status: 409 }
      );
    }
  } else {
    checkoutAttemptIdentity = resolveIdentity(null);
    const lookup = await getExistingCheckout(checkoutAttemptIdentity);
    if (lookup.error) {
      const fingerprintConflict = lookup.error.message?.includes("different purchase details");
      return NextResponse.json(
        { error: fingerprintConflict ? "This checkout attempt does not match the original purchase." : "Unable to resume checkout." },
        { status: fingerprintConflict ? 409 : 500 }
      );
    }
    existingCheckout = lookup.checkout;
  }

  if (existingCheckout?.checkout_mode === "stub") {
    return resumeStubCheckout(supabase, existingCheckout);
  }
  if (existingCheckout?.checkout_mode === "stripe") {
    return resumeStripeCheckout(supabase, existingCheckout);
  }

  if (checkoutAttemptId) {
    const activeCartResult = await findCustomerCarts("active");
    if (activeCartResult.error) {
      return NextResponse.json({ error: activeCartResult.error.message }, { status: 500 });
    }
    if (!activeCartResult.exhaustive) {
      return NextResponse.json(
        { error: "We could not safely identify your active cart. Please refresh your cart and try again." },
        { status: 409 }
      );
    }
    sourceCartId = activeCartResult.carts[0]?.id ?? null;
  }
  const sessionLink = await resolveStorefrontSessionLink(supabase, {
    storeId: store.id,
    sessionKey: analyticsSessionId
  });

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

  const { data: checkoutSettings, error: checkoutSettingsError } = await supabase
    .from("store_settings")
    .select(
      "checkout_enable_local_pickup,checkout_local_pickup_label,checkout_local_pickup_fee_cents,checkout_enable_flat_rate_shipping,checkout_flat_rate_shipping_label,checkout_flat_rate_shipping_fee_cents,checkout_allow_order_note,checkout_max_promo_codes"
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
      checkout_max_promo_codes: number | null;
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
  const normalizedPhone = phone.trim();
  let resolvedPickupLocationId: string | null = null;
  let resolvedPickupLocationSnapshot: Record<string, unknown> | null = null;
  let resolvedPickupWindowStartAt: string | null = null;
  let resolvedPickupWindowEndAt: string | null = null;
  let resolvedPickupTimezone: string | null = null;
  const resolvedPickupSettings = {
    pickup_enabled: pickupSettings?.pickup_enabled ?? false,
    selection_mode: pickupSettings?.selection_mode ?? "buyer_select",
    geolocation_fallback_mode: pickupSettings?.geolocation_fallback_mode ?? "allow_without_distance",
    out_of_radius_behavior: pickupSettings?.out_of_radius_behavior ?? "allow_all_locations",
    eligibility_radius_miles: pickupSettings?.eligibility_radius_miles ?? 100,
    lead_time_hours: pickupSettings?.lead_time_hours ?? 48,
    slot_interval_minutes: pickupSettings?.slot_interval_minutes ?? 60,
    show_pickup_times: pickupSettings?.show_pickup_times ?? true,
    timezone: pickupSettings?.timezone ?? "America/New_York"
  } as const;

  if (selectedFulfillment.method === "pickup") {
    const buyerCoordinates =
      Number.isFinite(buyerLatitude) && Number.isFinite(buyerLongitude)
        ? {
            latitude: buyerLatitude as number,
            longitude: buyerLongitude as number
          }
        : null;

    // When availability rules are off and no locations exist, allow pickup as a
    // simple fulfillment method (e.g. "Porch pickup") with no location required.
    const locationlessPickup = !resolvedPickupSettings.pickup_enabled && (pickupLocations ?? []).length === 0;

    if (!locationlessPickup) {
      if ((pickupLocations ?? []).length === 0) {
        return NextResponse.json({ error: "Pickup is unavailable for this store." }, { status: 400 });
      }

      const normalizedPickupLocations = (pickupLocations ?? []).map((location) => ({
        id: location.id,
        name: location.name,
        latitude: location.latitude,
        longitude: location.longitude
      }));
      const availablePickupLocations = resolvedPickupSettings.pickup_enabled
        ? resolveAvailablePickupLocations({
            buyer: buyerCoordinates,
            locations: normalizedPickupLocations,
            radiusMiles: resolvedPickupSettings.eligibility_radius_miles,
            geolocationFallbackMode: resolvedPickupSettings.geolocation_fallback_mode,
            outOfRadiusBehavior: resolvedPickupSettings.out_of_radius_behavior
          })
        : normalizedPickupLocations.map((location) => ({
            id: location.id,
            name: location.name,
            distanceMiles: 0
          }));

      if (availablePickupLocations.length === 0) {
        const reason = buyerCoordinates
          ? `No pickup locations are available within ${resolvedPickupSettings.eligibility_radius_miles} miles.`
          : "Enable location access to verify pickup availability.";
        return NextResponse.json(
          { error: reason },
          { status: 400 }
        );
      }

      resolvedPickupLocationId =
        resolvedPickupSettings.selection_mode === "hidden_nearest"
          ? availablePickupLocations[0]?.id ?? null
          : pickupLocationId && availablePickupLocations.some((location) => location.id === pickupLocationId)
            ? pickupLocationId
            : null;

      if (!resolvedPickupLocationId) {
        return NextResponse.json({ error: "Select a pickup location." }, { status: 400 });
      }
    }

    if (locationlessPickup) {
      // No location or time slot — seller coordinates pickup details via email.
      resolvedPickupLocationId = null;
      resolvedPickupLocationSnapshot = null;
      resolvedPickupWindowStartAt = null;
      resolvedPickupWindowEndAt = null;
      resolvedPickupTimezone = resolvedPickupSettings.timezone;
    } else {
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
        leadTimeHours: resolvedPickupSettings.lead_time_hours,
        slotIntervalMinutes: resolvedPickupSettings.slot_interval_minutes,
        timezone: resolvedPickupSettings.timezone,
        dayHours,
        blackoutWindows: (pickupBlackouts ?? []).map((entry) => ({
          startsAt: new Date(entry.starts_at),
          endsAt: new Date(entry.ends_at)
        })),
        maxSlots: 300
      });

      if (resolvedPickupSettings.show_pickup_times && validSlots.length === 0) {
        return NextResponse.json({ error: "No pickup times are currently available for the selected location." }, { status: 400 });
      }

      if (resolvedPickupSettings.show_pickup_times && (!pickupWindowStartAt || !pickupWindowEndAt)) {
        return NextResponse.json({ error: "Select a pickup time window." }, { status: 400 });
      }

      if (!resolvedPickupSettings.show_pickup_times) {
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

      resolvedPickupTimezone = resolvedPickupSettings.timezone;
    }
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
    .select("id,product_id,title,price_cents,inventory_qty,is_made_to_order,status,option_values,products!inner(id,title,status,store_id,product_type)")
    .eq("store_id", store.id)
    .in("id", variantIds)
    .returns<VariantRow[]>();

  if (variantsError) {
    return NextResponse.json({ error: variantsError.message }, { status: 500 });
  }

  const variantMap = new Map((variants ?? []).map((variant) => [variant.id, variant]));
  const rpcItems: Array<{
    productId: string;
    variantId: string;
    quantity: number;
    variantLabel: string;
    productTitle: string;
    productType: "physical" | "digital";
    unitPriceCents: number;
  }> = [];
  let subtotalCents = 0;
  let hasDigitalItems = false;
  let hasPhysicalItems = false;

  for (const [variantId, entry] of aggregatedVariantItems.entries()) {
    const variant = variantMap.get(variantId);

    if (!variant || variant.status !== "active") {
      return NextResponse.json({ error: `Selected variant ${variantId} is unavailable.` }, { status: 400 });
    }

    const product = normalizeVariantProduct(variant.products);

    if (!product || product.status !== "active") {
      return NextResponse.json({ error: "A selected product is unavailable." }, { status: 400 });
    }

    if (product.product_type === "digital") {
      hasDigitalItems = true;
      if (entry.quantity !== 1) return NextResponse.json({ error: "Digital products have a quantity of one." }, { status: 400 });
    } else {
      hasPhysicalItems = true;
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
      productType: product.product_type,
      unitPriceCents: variant.price_cents
    });
  }

  let discountCents = 0;
  let normalizedPromoCode: string | null = null;
  let normalizedPromoCodes: string[] = [];
  let appliedPromotions: AppliedPromotionSummary[] = [];
  const normalizedCustomerEmail = normalizePromotionRedemptionEmail(email);
  let shippingFeeCents = selectedFulfillment.feeCents;
  if (hasDigitalItems && !digitalDeliveryConsent) {
    return NextResponse.json({ error: "Confirm immediate digital delivery before checkout." }, { status: 400 });
  }
  if (!hasPhysicalItems) shippingFeeCents = 0;

  normalizedPromoCodes = normalizeRequestedPromoCodes({ promoCode, promoCodes });
  normalizedPromoCode = normalizedPromoCodes.length > 0 ? normalizedPromoCodes.join(", ") : null;

  if (normalizedPromoCodes.length > 0) {
    const { data: promotions, error: promotionError } = await supabase
      .from("promotions")
      .select("id,code,discount_type,discount_value,min_subtotal_cents,max_redemptions,per_customer_redemption_limit,times_redeemed,starts_at,ends_at,is_active,is_stackable")
      .eq("store_id", store.id)
      .in("code", normalizedPromoCodes)
      .returns<Array<PromotionApplicationRecord>>();

    if (promotionError) {
      return NextResponse.json({ error: promotionError.message }, { status: 500 });
    }

    const promotionsByCode = new Map((promotions ?? []).map((promotion) => [promotion.code, promotion]));

    try {
      const promotionApplication = await applyPromotionSequence({
        requestedCodes: normalizedPromoCodes,
        promotionsByCode,
        subtotalCents,
        shippingFeeCents: selectedFulfillment.method === "shipping" ? selectedFulfillment.feeCents : 0,
        maxPromoCodes: checkoutSettings?.checkout_max_promo_codes ?? 1,
        allowShippingPromotions: selectedFulfillment.method === "shipping",
        getCustomerRedemptionCount: async (promotion) => {
          const redemptionIds = new Set<string>();

          const { data: emailRedemptions, error: emailRedemptionsError } = await supabase
            .from("promotion_redemptions")
            .select("id")
            .eq("promotion_id", promotion.id)
            .eq("customer_email_normalized", normalizedCustomerEmail)
            .returns<Array<{ id: string }>>();

          if (emailRedemptionsError) {
            throw new Error(emailRedemptionsError.message);
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
              throw new Error(userRedemptionsError.message);
            }

            for (const redemption of userRedemptions ?? []) {
              redemptionIds.add(redemption.id);
            }
          }

          return redemptionIds.size;
        }
      });

      discountCents = promotionApplication.itemDiscountCents;
      appliedPromotions = promotionApplication.appliedPromotions;
      shippingFeeCents = selectedFulfillment.method === "shipping" ? promotionApplication.effectiveShippingFeeCents : selectedFulfillment.feeCents;
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : PROMOTION_CUSTOMER_CAP_REACHED_ERROR },
        { status: 400 }
      );
    }
  }

  const itemTotalCents = Math.max(0, subtotalCents - discountCents);
  const totalCents = itemTotalCents + shippingFeeCents;
  const feeProfile = await resolveStoreFeeProfile(store.id);
  const platformFeeCents = calculatePlatformFeeCents(totalCents, feeProfile);

  if (totalCents < 0) {
    return NextResponse.json({ error: "Order total must not be negative." }, { status: 400 });
  }

  const isFreeOrder = totalCents === 0;
  const shouldUseStubMode = isStripeStubMode() || isFreeOrder || (isStoreTeamMember && !isStorePubliclyAccessibleStatus(store.status));
  const digitalConsentAcceptedAt = hasDigitalItems ? new Date().toISOString() : null;
  const pendingCheckoutValues = {
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
    digital_consent_version: hasDigitalItems ? DIGITAL_PRODUCT_CONFIG.consentVersion : null,
    digital_consent_accepted_at: digitalConsentAcceptedAt,
    digital_license_version: hasDigitalItems ? DIGITAL_PRODUCT_CONFIG.licenseVersion : null,
    pickup_location_id: resolvedPickupLocationId,
    pickup_location_snapshot_json: resolvedPickupLocationSnapshot,
    pickup_window_start_at: resolvedPickupWindowStartAt,
    pickup_window_end_at: resolvedPickupWindowEndAt,
    pickup_timezone: resolvedPickupTimezone,
    promo_code: normalizedPromoCode,
    promo_codes_json: normalizedPromoCodes,
    applied_promotions_json: appliedPromotions,
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
    checkout_mode: shouldUseStubMode ? "stub" : "stripe",
    stripe_account_id_snapshot: shouldUseStubMode ? null : store.stripe_account_id,
    tax_collection_mode_snapshot: taxCollectionMode,
    status: "pending"
  } as const;

  const createPendingCheckout = async () => {
    const result = await supabase.rpc("create_or_reuse_storefront_checkout_attempt", {
      p_store_id: store.id,
      p_checkout_attempt_key: checkoutAttemptIdentity.attemptKey,
      p_request_fingerprint_sha256: checkoutAttemptIdentity.fingerprintSha256,
      p_checkout: pendingCheckoutValues
    });

    return {
      data: result.data as CheckoutAttemptRow | null,
      error: result.error
    };
  };

  if (shouldUseStubMode) {
    const { data: pendingCheckout, error: pendingCheckoutError } = await createPendingCheckout();
    if (pendingCheckoutError || !pendingCheckout) {
      const fingerprintConflict = pendingCheckoutError?.message?.includes("different purchase details");
      return NextResponse.json(
        { error: pendingCheckoutError?.message ?? "Unable to create checkout session." },
        { status: fingerprintConflict ? 409 : 500 }
      );
    }
    return resumeStubCheckout(supabase, pendingCheckout);
  }

  if (!store.stripe_account_id) {
    return NextResponse.json({ error: "This store has not configured payments yet." }, { status: 400 });
  }

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

  const { data: pendingCheckout, error: pendingCheckoutError } = await createPendingCheckout();

  if (pendingCheckoutError || !pendingCheckout) {
    const fingerprintConflict = pendingCheckoutError?.message?.includes("different purchase details");
    return NextResponse.json(
      { error: pendingCheckoutError?.message ?? "Unable to create checkout session." },
      { status: fingerprintConflict ? 409 : 500 }
    );
  }

  return resumeStripeCheckout(supabase, pendingCheckout);
}
