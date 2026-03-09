import type { OwnedStoreBundle } from "@/lib/stores/owner-store";

type ShippingConfigSnapshot = {
  provider: string;
  source: string;
  apiKey?: string | null;
  webhookSecret?: string | null;
};

export function buildStoreEditorSettingsPayload(bundle: OwnedStoreBundle, shippingConfig: ShippingConfigSnapshot) {
  return {
    profile: {
      id: bundle.store.id,
      name: bundle.store.name,
      slug: bundle.store.slug,
      status: bundle.store.status
    },
    branding: bundle.branding,
    checkoutRules: {
      fulfillmentMessage: bundle.settings?.fulfillment_message ?? null,
      checkoutEnableLocalPickup: bundle.settings?.checkout_enable_local_pickup ?? false,
      checkoutLocalPickupLabel: bundle.settings?.checkout_local_pickup_label ?? "Porch pickup",
      checkoutLocalPickupFeeCents: bundle.settings?.checkout_local_pickup_fee_cents ?? 0,
      checkoutEnableFlatRateShipping: bundle.settings?.checkout_enable_flat_rate_shipping ?? true,
      checkoutFlatRateShippingLabel: bundle.settings?.checkout_flat_rate_shipping_label ?? "Shipped (flat fee)",
      checkoutFlatRateShippingFeeCents: bundle.settings?.checkout_flat_rate_shipping_fee_cents ?? 0,
      checkoutAllowOrderNote: bundle.settings?.checkout_allow_order_note ?? false,
      checkoutOrderNotePrompt:
        bundle.settings?.checkout_order_note_prompt ??
        "If you have any questions, comments, or concerns about your order, leave a note below."
    },
    seo: {
      title: bundle.settings?.seo_title ?? null,
      description: bundle.settings?.seo_description ?? null,
      noindex: bundle.settings?.seo_noindex ?? false,
      location: {
        city: bundle.settings?.seo_location_city ?? null,
        region: bundle.settings?.seo_location_region ?? null,
        state: bundle.settings?.seo_location_state ?? null,
        postalCode: bundle.settings?.seo_location_postal_code ?? null,
        countryCode: bundle.settings?.seo_location_country_code ?? null,
        addressLine1: bundle.settings?.seo_location_address_line1 ?? null,
        addressLine2: bundle.settings?.seo_location_address_line2 ?? null,
        showFullAddress: bundle.settings?.seo_location_show_full_address ?? false
      }
    },
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
  };
}
