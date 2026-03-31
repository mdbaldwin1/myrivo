import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { applyPromotionSequence, normalizeRequestedPromoCodes } from "@/lib/promotions/apply-promotions";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { resolveStoreSlugFromRequestAsync } from "@/lib/stores/active-store";
import { isStorePubliclyAccessibleStatus } from "@/lib/stores/lifecycle";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const payloadSchema = z.object({
  promoCode: z.string().trim().min(3).max(40),
  promoCodes: z.array(z.string().trim().min(3).max(40)).optional(),
  subtotalCents: z.number().int().nonnegative(),
  shippingFeeCents: z.number().int().nonnegative().optional(),
  fulfillmentMethod: z.enum(["pickup", "shipping"]).optional()
});

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);

  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const rateLimitResponse = await checkRateLimit(request, {
    key: "promo-preview",
    limit: 60,
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
  const { subtotalCents } = payload.data;
  const requestedCodes = normalizeRequestedPromoCodes({
    promoCode: payload.data.promoCode,
    promoCodes: payload.data.promoCodes
  });
  const storeSlug = await resolveStoreSlugFromRequestAsync(request);
  if (!storeSlug) {
    return NextResponse.json({ error: "Store context is required." }, { status: 400 });
  }

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id,status")
    .eq("slug", storeSlug)
    .maybeSingle<{ id: string; status: string }>();

  if (storeError) {
    return NextResponse.json({ error: storeError.message }, { status: 500 });
  }

  if (!store || !isStorePubliclyAccessibleStatus(store.status)) {
    return NextResponse.json({ error: "Store not found or inactive." }, { status: 404 });
  }

  const { data: checkoutSettings, error: checkoutSettingsError } = await supabase
    .from("store_settings")
    .select("checkout_max_promo_codes")
    .eq("store_id", store.id)
    .maybeSingle<{ checkout_max_promo_codes: number | null }>();

  if (checkoutSettingsError) {
    return NextResponse.json({ error: checkoutSettingsError.message }, { status: 500 });
  }

  const { data: promotions, error: promotionError } = await supabase
    .from("promotions")
    .select("id,code,discount_type,discount_value,min_subtotal_cents,max_redemptions,per_customer_redemption_limit,times_redeemed,starts_at,ends_at,is_active,is_stackable")
    .eq("store_id", store.id)
    .in("code", requestedCodes);

  if (promotionError) {
    return NextResponse.json({ error: promotionError.message }, { status: 500 });
  }

  const promotionsByCode = new Map((promotions ?? []).map((promotion) => [promotion.code, promotion]));

  let promotionApplication;
  try {
    promotionApplication = await applyPromotionSequence({
      requestedCodes,
      promotionsByCode,
      subtotalCents,
      shippingFeeCents: payload.data.shippingFeeCents ?? 0,
      maxPromoCodes: checkoutSettings?.checkout_max_promo_codes ?? 1,
      allowShippingPromotions: (payload.data.fulfillmentMethod ?? "shipping") === "shipping"
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to apply promo code." }, { status: 400 });
  }

  return NextResponse.json({
    promoCode: requestedCodes[requestedCodes.length - 1] ?? null,
    promoCodes: promotionApplication.appliedPromotions.map((promotion) => promotion.code),
    promotionType: promotionApplication.appliedPromotions[promotionApplication.appliedPromotions.length - 1]?.discountType ?? null,
    discountCents: promotionApplication.itemDiscountCents,
    shippingDiscountCents: promotionApplication.shippingDiscountCents,
    effectiveShippingFeeCents: promotionApplication.effectiveShippingFeeCents,
    discountedTotalCents: promotionApplication.discountedTotalCents
  });
}
