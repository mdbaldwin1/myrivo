import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getStoreShippingConfig } from "@/lib/shipping/store-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";

const settingsUpdateSchema = z.object({
  profile: z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      status: z.enum(["draft", "active", "suspended"]).optional()
    })
    .optional(),
  branding: z
    .object({
      primaryColor: z.string().regex(/^#([0-9a-fA-F]{6})$/).nullable().optional(),
      accentColor: z.string().regex(/^#([0-9a-fA-F]{6})$/).nullable().optional(),
      logoPath: z.string().max(500).nullable().optional(),
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
    .optional()
});

async function resolveOwnerContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  const bundle = await getOwnedStoreBundle(user.id, "staff");
  if (!bundle) {
    return { error: NextResponse.json({ error: "No store found for account" }, { status: 404 }) } as const;
  }

  return { supabase, bundle } as const;
}

export async function GET() {
  const resolved = await resolveOwnerContext();
  if ("error" in resolved) {
    return resolved.error;
  }

  const { bundle, supabase } = resolved;
  const shippingConfig = await getStoreShippingConfig(supabase, bundle.store.id, true);

  return NextResponse.json({
    settings: {
      profile: {
        id: bundle.store.id,
        name: bundle.store.name,
        slug: bundle.store.slug,
        status: bundle.store.status
      },
      branding: bundle.branding,
      checkoutRules: bundle.settings
        ? {
            fulfillmentMessage: bundle.settings.fulfillment_message,
            checkoutEnableLocalPickup: bundle.settings.checkout_enable_local_pickup,
            checkoutLocalPickupLabel: bundle.settings.checkout_local_pickup_label,
            checkoutLocalPickupFeeCents: bundle.settings.checkout_local_pickup_fee_cents,
            checkoutEnableFlatRateShipping: bundle.settings.checkout_enable_flat_rate_shipping,
            checkoutFlatRateShippingLabel: bundle.settings.checkout_flat_rate_shipping_label,
            checkoutFlatRateShippingFeeCents: bundle.settings.checkout_flat_rate_shipping_fee_cents,
            checkoutAllowOrderNote: bundle.settings.checkout_allow_order_note,
            checkoutOrderNotePrompt: bundle.settings.checkout_order_note_prompt
          }
        : null,
      integrations: {
        payments: {
          stripeAccountId: bundle.store.stripe_account_id
        },
        shipping: {
          provider: shippingConfig.provider,
          source: shippingConfig.source,
          hasApiKey: Boolean(shippingConfig.apiKey),
          hasWebhookSecret: Boolean(shippingConfig.webhookSecret)
        }
      }
    }
  });
}

export async function PUT(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = settingsUpdateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const resolved = await resolveOwnerContext();
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
    if (payload.data.profile.status !== undefined) {
      updates.status = payload.data.profile.status;
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
      primary_color: payload.data.branding.primaryColor ?? bundle.branding?.primary_color ?? null,
      accent_color: payload.data.branding.accentColor ?? bundle.branding?.accent_color ?? null,
      theme_json: payload.data.branding.themeJson ? { ...currentTheme, ...payload.data.branding.themeJson } : currentTheme
    };

    const { error } = await supabase.from("store_branding").upsert(brandingRecord, { onConflict: "store_id" });
    if (error) {
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

  return NextResponse.json({ ok: true, updatedAreas });
}

