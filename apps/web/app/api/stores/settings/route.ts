import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";

const settingsSchema = z.object({
  supportEmail: z.string().email().nullable().optional(),
  fulfillmentMessage: z.string().max(240).nullable().optional(),
  shippingPolicy: z.string().max(2000).nullable().optional(),
  returnPolicy: z.string().max(2000).nullable().optional(),
  announcement: z.string().max(300).nullable().optional(),
  footerTagline: z.string().max(120).nullable().optional(),
  footerNote: z.string().max(240).nullable().optional(),
  instagramUrl: z.string().url().max(300).nullable().optional(),
  facebookUrl: z.string().url().max(300).nullable().optional(),
  tiktokUrl: z.string().url().max(300).nullable().optional(),
  policyFaqs: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        question: z.string().min(1).max(200),
        answer: z.string().min(1).max(2000),
        sortOrder: z.number().int().min(0).max(999),
        isActive: z.boolean()
      })
    )
    .max(24)
    .nullable()
    .optional(),
  aboutArticleHtml: z.string().max(30000).nullable().optional(),
  aboutSections: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        title: z.string().max(120),
        body: z.string().max(4000),
        imageUrl: z.string().url().max(500).nullable(),
        layout: z.enum(["image_left", "image_right", "full"])
      })
    )
    .max(24)
    .nullable()
    .optional(),
  storefrontCopy: z.record(z.string(), z.unknown()).nullable().optional(),
  emailCaptureEnabled: z.boolean().optional(),
  emailCaptureHeading: z.string().max(120).nullable().optional(),
  emailCaptureDescription: z.string().max(280).nullable().optional(),
  emailCaptureSuccessMessage: z.string().max(180).nullable().optional(),
  checkoutEnableLocalPickup: z.boolean().optional(),
  checkoutLocalPickupLabel: z.string().max(120).nullable().optional(),
  checkoutLocalPickupFeeCents: z.number().int().min(0).max(250000).optional(),
  checkoutEnableFlatRateShipping: z.boolean().optional(),
  checkoutFlatRateShippingLabel: z.string().max(120).nullable().optional(),
  checkoutFlatRateShippingFeeCents: z.number().int().min(0).max(250000).optional(),
  checkoutAllowOrderNote: z.boolean().optional(),
  checkoutOrderNotePrompt: z.string().max(300).nullable().optional()
});

export async function GET() {
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

  return NextResponse.json({ settings: bundle.settings });
}

export async function PUT(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);

  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, settingsSchema);
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

  const existing = bundle.settings;
  const hasField = (key: keyof z.infer<typeof settingsSchema>) => Object.prototype.hasOwnProperty.call(payload.data, key);
  const resolveValue = <T>(key: keyof z.infer<typeof settingsSchema>, next: T, fallback: T) => (hasField(key) ? next : fallback);

  const { data, error } = await supabase
    .from("store_settings")
    .upsert(
      {
        store_id: bundle.store.id,
        support_email: resolveValue("supportEmail", payload.data.supportEmail ?? null, existing?.support_email ?? null),
        fulfillment_message: resolveValue("fulfillmentMessage", payload.data.fulfillmentMessage ?? null, existing?.fulfillment_message ?? null),
        shipping_policy: resolveValue("shippingPolicy", payload.data.shippingPolicy ?? null, existing?.shipping_policy ?? null),
        return_policy: resolveValue("returnPolicy", payload.data.returnPolicy ?? null, existing?.return_policy ?? null),
        announcement: resolveValue("announcement", payload.data.announcement ?? null, existing?.announcement ?? null),
        footer_tagline: resolveValue("footerTagline", payload.data.footerTagline ?? null, existing?.footer_tagline ?? null),
        footer_note: resolveValue("footerNote", payload.data.footerNote ?? null, existing?.footer_note ?? null),
        instagram_url: resolveValue("instagramUrl", payload.data.instagramUrl ?? null, existing?.instagram_url ?? null),
        facebook_url: resolveValue("facebookUrl", payload.data.facebookUrl ?? null, existing?.facebook_url ?? null),
        tiktok_url: resolveValue("tiktokUrl", payload.data.tiktokUrl ?? null, existing?.tiktok_url ?? null),
        policy_faqs: hasField("policyFaqs")
          ? (payload.data.policyFaqs ?? []).map((faq) => ({
              id: faq.id,
              question: faq.question,
              answer: faq.answer,
              sort_order: faq.sortOrder,
              is_active: faq.isActive
            }))
          : (existing?.policy_faqs ?? []),
        about_article_html: resolveValue("aboutArticleHtml", payload.data.aboutArticleHtml ?? null, existing?.about_article_html ?? null),
        about_sections: resolveValue("aboutSections", payload.data.aboutSections ?? [], existing?.about_sections ?? []),
        storefront_copy_json: resolveValue("storefrontCopy", payload.data.storefrontCopy ?? {}, existing?.storefront_copy_json ?? {}),
        email_capture_enabled: resolveValue("emailCaptureEnabled", payload.data.emailCaptureEnabled ?? false, existing?.email_capture_enabled ?? false),
        email_capture_heading: resolveValue("emailCaptureHeading", payload.data.emailCaptureHeading ?? null, existing?.email_capture_heading ?? null),
        email_capture_description: resolveValue(
          "emailCaptureDescription",
          payload.data.emailCaptureDescription ?? null,
          existing?.email_capture_description ?? null
        ),
        email_capture_success_message: resolveValue(
          "emailCaptureSuccessMessage",
          payload.data.emailCaptureSuccessMessage ?? null,
          existing?.email_capture_success_message ?? null
        ),
        checkout_enable_local_pickup: resolveValue(
          "checkoutEnableLocalPickup",
          payload.data.checkoutEnableLocalPickup ?? false,
          existing?.checkout_enable_local_pickup ?? false
        ),
        checkout_local_pickup_label: resolveValue(
          "checkoutLocalPickupLabel",
          payload.data.checkoutLocalPickupLabel ?? null,
          existing?.checkout_local_pickup_label ?? null
        ),
        checkout_local_pickup_fee_cents: resolveValue(
          "checkoutLocalPickupFeeCents",
          payload.data.checkoutLocalPickupFeeCents ?? 0,
          existing?.checkout_local_pickup_fee_cents ?? 0
        ),
        checkout_enable_flat_rate_shipping: resolveValue(
          "checkoutEnableFlatRateShipping",
          payload.data.checkoutEnableFlatRateShipping ?? true,
          existing?.checkout_enable_flat_rate_shipping ?? true
        ),
        checkout_flat_rate_shipping_label: resolveValue(
          "checkoutFlatRateShippingLabel",
          payload.data.checkoutFlatRateShippingLabel ?? null,
          existing?.checkout_flat_rate_shipping_label ?? null
        ),
        checkout_flat_rate_shipping_fee_cents: resolveValue(
          "checkoutFlatRateShippingFeeCents",
          payload.data.checkoutFlatRateShippingFeeCents ?? 0,
          existing?.checkout_flat_rate_shipping_fee_cents ?? 0
        ),
        checkout_allow_order_note: resolveValue(
          "checkoutAllowOrderNote",
          payload.data.checkoutAllowOrderNote ?? false,
          existing?.checkout_allow_order_note ?? false
        ),
        checkout_order_note_prompt: resolveValue(
          "checkoutOrderNotePrompt",
          payload.data.checkoutOrderNotePrompt ?? null,
          existing?.checkout_order_note_prompt ?? null
        )
      },
      { onConflict: "store_id" }
    )
    .select(
      "support_email,fulfillment_message,shipping_policy,return_policy,announcement,footer_tagline,footer_note,instagram_url,facebook_url,tiktok_url,policy_faqs,about_article_html,about_sections,storefront_copy_json,email_capture_enabled,email_capture_heading,email_capture_description,email_capture_success_message,checkout_enable_local_pickup,checkout_local_pickup_label,checkout_local_pickup_fee_cents,checkout_enable_flat_rate_shipping,checkout_flat_rate_shipping_label,checkout_flat_rate_shipping_fee_cents,checkout_allow_order_note,checkout_order_note_prompt"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: bundle.store.id,
    actorUserId: user.id,
    action: "update",
    entity: "store_settings",
    entityId: bundle.store.id,
    metadata: {
      supportEmail: payload.data.supportEmail ?? null,
      hasAnnouncement: Boolean(payload.data.announcement),
      hasShippingPolicy: Boolean(payload.data.shippingPolicy),
      hasReturnPolicy: Boolean(payload.data.returnPolicy),
      hasFooterTagline: Boolean(payload.data.footerTagline),
      hasFooterNote: Boolean(payload.data.footerNote),
      socialLinkCount: [payload.data.instagramUrl, payload.data.facebookUrl, payload.data.tiktokUrl].filter(Boolean).length,
      policyFaqsCount: payload.data.policyFaqs?.length ?? 0,
      hasAboutArticle: Boolean(payload.data.aboutArticleHtml),
      aboutSectionsCount: payload.data.aboutSections?.length ?? 0,
      hasStorefrontCopyOverrides: Boolean(payload.data.storefrontCopy && Object.keys(payload.data.storefrontCopy).length > 0),
      emailCaptureEnabled: payload.data.emailCaptureEnabled ?? false,
      checkoutEnableLocalPickup: payload.data.checkoutEnableLocalPickup ?? false,
      checkoutEnableFlatRateShipping: payload.data.checkoutEnableFlatRateShipping ?? true,
      checkoutAllowOrderNote: payload.data.checkoutAllowOrderNote ?? false
    }
  });

  return NextResponse.json({ settings: data });
}
