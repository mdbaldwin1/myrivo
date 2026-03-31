import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { sendWelcomeDiscountEmail } from "@/lib/marketing-email/welcome-discount";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { STOREFRONT_WELCOME_POPUP_SOURCE } from "@/lib/storefront/welcome-popup";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveStoreSlugFromRequestAsync } from "@/lib/stores/active-store";
import { isStorePubliclyAccessibleStatus } from "@/lib/stores/lifecycle";

const subscribeSchema = z.object({
  email: z.string().email().max(320),
  storeSlug: z.string().trim().max(120).optional(),
  source: z.string().trim().max(80).optional().default("storefront"),
  location: z.string().trim().max(400).optional().default(""),
  welcomePopupPromotionId: z.string().uuid().nullable().optional().default(null),
  welcomePopupCampaignKey: z.string().trim().max(400).nullable().optional().default(null)
});

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const rateLimitResponse = await checkRateLimit(request, {
    key: "newsletter-subscribe",
    limit: 10,
    windowMs: 60_000
  });

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const parsed = await parseJsonRequest(request, subscribeSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const consentCapturedAt = new Date().toISOString();
  const isWelcomePopupSignup = parsed.data.source.trim() === STOREFRONT_WELCOME_POPUP_SOURCE;
  const consentMetadata = {
    consent_source: parsed.data.source.trim() || "storefront",
    consent_location: parsed.data.location.trim() || null,
    consent_captured_at: consentCapturedAt,
    suppression_reason: null,
    welcome_popup_campaign_key: parsed.data.welcomePopupCampaignKey ?? null,
    welcome_popup_promotion_id: parsed.data.welcomePopupPromotionId ?? null,
    welcome_popup_email_sent_at: null
  };
  const supabase = createSupabaseAdminClient();
  const requestedStoreSlug = parsed.data.storeSlug?.trim().toLowerCase() || null;
  const storeSlug = requestedStoreSlug || (await resolveStoreSlugFromRequestAsync(request));
  if (!storeSlug) {
    return NextResponse.json({ error: "Store context is required." }, { status: 400 });
  }

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id,name,slug,status")
    .eq("slug", storeSlug)
    .maybeSingle<{ id: string; name: string; slug: string; status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed" }>();

  if (storeError) {
    return NextResponse.json({ error: storeError.message }, { status: 500 });
  }

  if (!store || !isStorePubliclyAccessibleStatus(store.status)) {
    return NextResponse.json({ error: "Newsletter signup is not available right now." }, { status: 400 });
  }

  const { data: settings, error: settingsError } = await supabase
    .from("store_settings")
    .select(
      "email_capture_enabled,welcome_popup_enabled,welcome_popup_promotion_id,support_email,seo_location_city,seo_location_region,seo_location_state,seo_location_postal_code,seo_location_country_code,seo_location_address_line1,seo_location_address_line2,seo_location_show_full_address"
    )
    .eq("store_id", store.id)
    .maybeSingle<{
      email_capture_enabled: boolean | null;
      welcome_popup_enabled: boolean | null;
      welcome_popup_promotion_id: string | null;
      support_email: string | null;
      seo_location_city: string | null;
      seo_location_region: string | null;
      seo_location_state: string | null;
      seo_location_postal_code: string | null;
      seo_location_country_code: string | null;
      seo_location_address_line1: string | null;
      seo_location_address_line2: string | null;
      seo_location_show_full_address: boolean | null;
    }>();

  if (settingsError) {
    return NextResponse.json({ error: settingsError.message }, { status: 500 });
  }

  if (!settings?.email_capture_enabled) {
    return NextResponse.json({ error: "Newsletter signup is currently disabled." }, { status: 400 });
  }

  let welcomePromotion:
    | {
        id: string;
        code: string;
        discount_type: "percent" | "fixed" | "free_shipping";
        discount_value: number;
        min_subtotal_cents: number;
        max_redemptions: number | null;
        times_redeemed: number;
        starts_at: string | null;
        ends_at: string | null;
        is_active: boolean;
      }
    | null = null;

  if (isWelcomePopupSignup) {
    if (!settings.welcome_popup_enabled || !settings.welcome_popup_promotion_id) {
      return NextResponse.json({ error: "Welcome offer signup is currently unavailable." }, { status: 400 });
    }

    if (parsed.data.welcomePopupPromotionId && parsed.data.welcomePopupPromotionId !== settings.welcome_popup_promotion_id) {
      return NextResponse.json({ error: "Welcome offer does not match the active store campaign." }, { status: 400 });
    }

    const { data: promotion, error: promotionError } = await supabase
      .from("promotions")
      .select("id,code,discount_type,discount_value,min_subtotal_cents,max_redemptions,times_redeemed,starts_at,ends_at,is_active")
      .eq("id", settings.welcome_popup_promotion_id)
      .eq("store_id", store.id)
      .maybeSingle<{
        id: string;
        code: string;
        discount_type: "percent" | "fixed" | "free_shipping";
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

    const nowIso = new Date().toISOString();
    const promotionIsEligible =
      Boolean(
        promotion?.is_active &&
          (!promotion.max_redemptions || promotion.times_redeemed < promotion.max_redemptions) &&
          (!promotion.starts_at || promotion.starts_at <= nowIso) &&
          (!promotion.ends_at || promotion.ends_at >= nowIso)
      );

    if (!promotion || !promotionIsEligible) {
      return NextResponse.json({ error: "The welcome offer is not available right now." }, { status: 400 });
    }

    welcomePromotion = promotion;
  }

  const { data: existing, error: existingError } = await supabase
    .from("store_email_subscribers")
    .select("id,status,metadata_json")
    .eq("store_id", store.id)
    .ilike("email", email)
    .maybeSingle<{ id: string; status: "subscribed" | "unsubscribed"; metadata_json: Record<string, unknown> | null }>();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existing) {
    if (existing.status === "subscribed") {
      return NextResponse.json({ success: true, alreadySubscribed: true, welcomeEmailSent: false });
    }

    const previousMetadata = existing.metadata_json ?? {};
    const alreadySentWelcomeEmail =
      isWelcomePopupSignup &&
      previousMetadata.welcome_popup_email_sent_at &&
      previousMetadata.welcome_popup_promotion_id === settings.welcome_popup_promotion_id;

    const { error: updateError } = await supabase
      .from("store_email_subscribers")
      .update({
        status: "subscribed",
        subscribed_at: consentCapturedAt,
        unsubscribed_at: null,
        metadata_json: {
          ...previousMetadata,
          ...consentMetadata,
          resubscribed_at: consentCapturedAt
        }
      })
      .eq("id", existing.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (isWelcomePopupSignup && welcomePromotion && !alreadySentWelcomeEmail) {
      const sendResult = await sendWelcomeDiscountEmail({
        store: { id: store.id, name: store.name, slug: store.slug },
        settings,
        promotion: welcomePromotion,
        recipientEmail: email
      });

      if (!sendResult.ok) {
        return NextResponse.json({ error: sendResult.error ?? "Unable to deliver welcome email." }, { status: 502 });
      }

      await supabase
        .from("store_email_subscribers")
        .update({
          metadata_json: {
            ...previousMetadata,
            ...consentMetadata,
            resubscribed_at: consentCapturedAt,
            welcome_popup_email_sent_at: consentCapturedAt
          }
        })
        .eq("id", existing.id);
    }

    return NextResponse.json({
      success: true,
      reactivated: true,
      welcomeEmailSent: Boolean(isWelcomePopupSignup && welcomePromotion && !alreadySentWelcomeEmail)
    });
  }

  const { error: insertError } = await supabase.from("store_email_subscribers").insert({
    store_id: store.id,
    email,
    status: "subscribed",
    source: parsed.data.source.trim() || "storefront",
    metadata_json: consentMetadata
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  if (isWelcomePopupSignup && welcomePromotion) {
    const sendResult = await sendWelcomeDiscountEmail({
      store: { id: store.id, name: store.name, slug: store.slug },
      settings,
      promotion: welcomePromotion,
      recipientEmail: email
    });

    if (!sendResult.ok) {
      return NextResponse.json({ error: sendResult.error ?? "Unable to deliver welcome email." }, { status: 502 });
    }

    await supabase
      .from("store_email_subscribers")
      .update({
        metadata_json: {
          ...consentMetadata,
          welcome_popup_email_sent_at: consentCapturedAt
        }
      })
      .eq("store_id", store.id)
      .eq("email", email);
  }

  return NextResponse.json({ success: true, welcomeEmailSent: Boolean(isWelcomePopupSignup && welcomePromotion) });
}
