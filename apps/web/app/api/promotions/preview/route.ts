import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calculateDiscountCents } from "@/lib/promotions/calculate-discount";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { resolveStoreSlugFromRequestAsync } from "@/lib/stores/active-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const payloadSchema = z.object({
  promoCode: z.string().trim().min(3).max(40),
  subtotalCents: z.number().int().nonnegative()
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
  const { promoCode, subtotalCents } = payload.data;
  const storeSlug = await resolveStoreSlugFromRequestAsync(request);
  if (!storeSlug) {
    return NextResponse.json({ error: "Store context is required." }, { status: 400 });
  }

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id")
    .eq("slug", storeSlug)
    .eq("status", "active")
    .maybeSingle();

  if (storeError) {
    return NextResponse.json({ error: storeError.message }, { status: 500 });
  }

  if (!store) {
    return NextResponse.json({ error: "Store not found or inactive." }, { status: 404 });
  }

  const { data: promotion, error: promotionError } = await supabase
    .from("promotions")
    .select("code,discount_type,discount_value,min_subtotal_cents,max_redemptions,times_redeemed,starts_at,ends_at,is_active")
    .eq("store_id", store.id)
    .eq("code", promoCode.toUpperCase())
    .maybeSingle();

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

  const discountCents = calculateDiscountCents(subtotalCents, promotion);
  const discountedTotalCents = Math.max(0, subtotalCents - discountCents);

  return NextResponse.json({
    promoCode: promotion.code,
    discountCents,
    discountedTotalCents
  });
}
