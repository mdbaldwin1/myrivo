import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getStoreShippingConfig } from "@/lib/shipping/store-config";
import { buildStoreEditorSettingsPayload } from "@/lib/store-editor/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundleForOptionalSlug } from "@/lib/stores/owner-store";
import { isMissingColumnInSchemaCache } from "@/lib/supabase/error-classifiers";

const settingsUpdateSchema = z.object({
  profile: z
    .object({
      name: z.string().trim().min(2).max(120).optional()
    })
    .optional(),
  branding: z
    .object({
      primaryColor: z.string().regex(/^#([0-9a-fA-F]{6})$/).nullable().optional(),
      accentColor: z.string().regex(/^#([0-9a-fA-F]{6})$/).nullable().optional(),
      logoPath: z.string().max(500).nullable().optional(),
      faviconPath: z.string().max(500).nullable().optional(),
      appleTouchIconPath: z.string().max(500).nullable().optional(),
      ogImagePath: z.string().max(500).nullable().optional(),
      twitterImagePath: z.string().max(500).nullable().optional(),
      themeJson: z.record(z.string(), z.unknown()).optional()
    })
    .optional(),
  checkoutRules: z
    .object({
      fulfillmentMessage: z.string().max(240).nullable().optional(),
      checkoutEnableLocalPickup: z.boolean().optional(),
      checkoutLocalPickupLabel: z.string().max(120).nullable().optional(),
      checkoutLocalPickupFeeCents: z.number().int().min(0).max(250000).optional(),
      checkoutEnableFlatRateShipping: z.boolean().optional(),
      checkoutFlatRateShippingLabel: z.string().max(120).nullable().optional(),
      checkoutFlatRateShippingFeeCents: z.number().int().min(0).max(250000).optional(),
      checkoutAllowOrderNote: z.boolean().optional(),
      checkoutOrderNotePrompt: z.string().max(300).nullable().optional()
    })
    .optional(),
  seo: z
    .object({
      title: z.string().max(120).nullable().optional(),
      description: z.string().max(320).nullable().optional(),
      noindex: z.boolean().optional(),
      location: z
        .object({
          city: z.string().max(120).nullable().optional(),
          region: z.string().max(120).nullable().optional(),
          state: z.string().max(120).nullable().optional(),
          postalCode: z.string().max(32).nullable().optional(),
          countryCode: z.string().max(2).nullable().optional(),
          addressLine1: z.string().max(200).nullable().optional(),
          addressLine2: z.string().max(200).nullable().optional(),
          showFullAddress: z.boolean().optional()
        })
        .optional()
    })
    .optional()
});

async function resolveOwnerContext(storeSlug?: string | null) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  const bundle = await getOwnedStoreBundleForOptionalSlug(user.id, storeSlug, "staff");
  if (!bundle) {
    return { error: NextResponse.json({ error: "No store found for account" }, { status: 404 }) } as const;
  }

  return { supabase, bundle } as const;
}

export async function GET(request: NextRequest) {
  const resolved = await resolveOwnerContext(request.nextUrl.searchParams.get("storeSlug"));
  if ("error" in resolved) {
    return resolved.error;
  }

  const { bundle, supabase } = resolved;
  const shippingConfig = await getStoreShippingConfig(supabase, bundle.store.id, true);

  return NextResponse.json({
    settings: buildStoreEditorSettingsPayload(bundle, shippingConfig)
  });
}

export async function PUT(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, settingsUpdateSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const resolved = await resolveOwnerContext(request.nextUrl.searchParams.get("storeSlug"));
  if ("error" in resolved) {
    return resolved.error;
  }

  const { bundle, supabase } = resolved;
  const updatedAreas: string[] = [];

  if (payload.data.profile) {
    const updates: Record<string, string> = {};
    if (payload.data.profile.name !== undefined) {
      updates.name = payload.data.profile.name;
    }
    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from("stores").update(updates).eq("id", bundle.store.id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      updatedAreas.push("profile");
    }
  }

  if (payload.data.branding) {
    const currentTheme = (bundle.branding?.theme_json ?? {}) as Record<string, unknown>;
    const brandingRecord = {
      store_id: bundle.store.id,
      logo_path: payload.data.branding.logoPath ?? bundle.branding?.logo_path ?? null,
      favicon_path: payload.data.branding.faviconPath ?? bundle.branding?.favicon_path ?? null,
      apple_touch_icon_path: payload.data.branding.appleTouchIconPath ?? bundle.branding?.apple_touch_icon_path ?? null,
      og_image_path: payload.data.branding.ogImagePath ?? bundle.branding?.og_image_path ?? null,
      twitter_image_path: payload.data.branding.twitterImagePath ?? bundle.branding?.twitter_image_path ?? null,
      primary_color: payload.data.branding.primaryColor ?? bundle.branding?.primary_color ?? null,
      accent_color: payload.data.branding.accentColor ?? bundle.branding?.accent_color ?? null,
      theme_json: payload.data.branding.themeJson ? { ...currentTheme, ...payload.data.branding.themeJson } : currentTheme
    };

    const { error } = await supabase.from("store_branding").upsert(brandingRecord, { onConflict: "store_id" });
    if (error) {
      if (
        isMissingColumnInSchemaCache(error, "seo_title") ||
        isMissingColumnInSchemaCache(error, "seo_description") ||
        isMissingColumnInSchemaCache(error, "seo_noindex")
      ) {
        return NextResponse.json(
          { error: "Store SEO fields require the latest database migration. Please run migrations and try again." },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    updatedAreas.push("branding");
  }

  if (payload.data.checkoutRules) {
    const current = bundle.settings;
    const next = payload.data.checkoutRules;
    const { error } = await supabase
      .from("store_settings")
      .upsert(
        {
          store_id: bundle.store.id,
          fulfillment_message: next.fulfillmentMessage ?? current?.fulfillment_message ?? null,
          checkout_enable_local_pickup: next.checkoutEnableLocalPickup ?? current?.checkout_enable_local_pickup ?? false,
          checkout_local_pickup_label: next.checkoutLocalPickupLabel ?? current?.checkout_local_pickup_label ?? "Porch pickup",
          checkout_local_pickup_fee_cents: next.checkoutLocalPickupFeeCents ?? current?.checkout_local_pickup_fee_cents ?? 0,
          checkout_enable_flat_rate_shipping: next.checkoutEnableFlatRateShipping ?? current?.checkout_enable_flat_rate_shipping ?? true,
          checkout_flat_rate_shipping_label: next.checkoutFlatRateShippingLabel ?? current?.checkout_flat_rate_shipping_label ?? "Shipped (flat fee)",
          checkout_flat_rate_shipping_fee_cents:
            next.checkoutFlatRateShippingFeeCents ?? current?.checkout_flat_rate_shipping_fee_cents ?? 0,
          checkout_allow_order_note: next.checkoutAllowOrderNote ?? current?.checkout_allow_order_note ?? false,
          checkout_order_note_prompt:
            next.checkoutOrderNotePrompt ??
            current?.checkout_order_note_prompt ??
            "If you have any questions, comments, or concerns about your order, leave a note below."
        },
        { onConflict: "store_id" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    updatedAreas.push("checkoutRules");
  }

  if (payload.data.seo) {
    const current = bundle.settings;
    const next = payload.data.seo;
    const { error } = await supabase
      .from("store_settings")
      .upsert(
        {
          store_id: bundle.store.id,
          seo_title: next.title ?? current?.seo_title ?? null,
          seo_description: next.description ?? current?.seo_description ?? null,
          seo_noindex: next.noindex ?? current?.seo_noindex ?? false,
          seo_location_city: next.location?.city ?? current?.seo_location_city ?? null,
          seo_location_region: next.location?.region ?? current?.seo_location_region ?? null,
          seo_location_state: next.location?.state ?? current?.seo_location_state ?? null,
          seo_location_postal_code: next.location?.postalCode ?? current?.seo_location_postal_code ?? null,
          seo_location_country_code: next.location?.countryCode ?? current?.seo_location_country_code ?? null,
          seo_location_address_line1: next.location?.addressLine1 ?? current?.seo_location_address_line1 ?? null,
          seo_location_address_line2: next.location?.addressLine2 ?? current?.seo_location_address_line2 ?? null,
          seo_location_show_full_address: next.location?.showFullAddress ?? current?.seo_location_show_full_address ?? false
        },
        { onConflict: "store_id" }
      );

    if (error) {
      if (isMissingColumnInSchemaCache(error, "seo_location_city") || isMissingColumnInSchemaCache(error, "seo_location_show_full_address")) {
        return NextResponse.json(
          { error: "Store SEO location fields require the latest database migration. Please run migrations and try again." },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    updatedAreas.push("seo");
  }

  return NextResponse.json({ ok: true, updatedAreas });
}
