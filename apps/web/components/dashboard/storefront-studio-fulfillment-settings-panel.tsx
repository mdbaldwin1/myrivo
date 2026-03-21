"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { notify } from "@/lib/feedback/toast";
import { buildStoreScopedApiPath } from "@/lib/routes/store-workspace";
import type { StorefrontSettings } from "@/lib/storefront/runtime";

type StorefrontStudioFulfillmentSettingsPanelProps = {
  storeSlug: string;
  showShipping: boolean;
  showPickup: boolean;
};

type StoreSettingsResponse = {
  settings?: {
    checkout_enable_flat_rate_shipping?: boolean | null;
    checkout_flat_rate_shipping_label?: string | null;
    checkout_flat_rate_shipping_fee_cents?: number | null;
    checkout_enable_local_pickup?: boolean | null;
    checkout_local_pickup_label?: string | null;
    checkout_local_pickup_fee_cents?: number | null;
    checkout_allow_order_note?: boolean | null;
    checkout_order_note_prompt?: string | null;
  };
  error?: string;
};

function ensureSettingsDraft(current: StorefrontSettings): NonNullable<StorefrontSettings> {
  return (
    current ?? {
      support_email: null,
      fulfillment_message: null,
      shipping_policy: null,
      return_policy: null,
      announcement: null,
      seo_title: null,
      seo_description: null,
      seo_noindex: false,
      seo_location_city: null,
      seo_location_region: null,
      seo_location_state: null,
      seo_location_postal_code: null,
      seo_location_country_code: null,
      seo_location_address_line1: null,
      seo_location_address_line2: null,
      seo_location_show_full_address: false,
      footer_tagline: null,
      footer_note: null,
      instagram_url: null,
      facebook_url: null,
      tiktok_url: null,
      storefront_copy_json: {},
      policy_faqs: null,
      about_article_html: null,
      about_sections: null,
      email_capture_enabled: false,
      email_capture_heading: null,
      email_capture_description: null,
      email_capture_success_message: null,
      checkout_enable_local_pickup: false,
      checkout_local_pickup_label: null,
      checkout_local_pickup_fee_cents: 0,
      checkout_enable_flat_rate_shipping: true,
      checkout_flat_rate_shipping_label: null,
      checkout_flat_rate_shipping_fee_cents: 0,
      checkout_allow_order_note: false,
      checkout_order_note_prompt: null,
      updated_at: null
    }
  );
}

function coerceMoneyInput(value: string) {
  const parsed = Number.parseInt(value || "0", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function StorefrontStudioFulfillmentSettingsPanel({
  storeSlug,
  showShipping,
  showPickup
}: StorefrontStudioFulfillmentSettingsPanelProps) {
  const document = useOptionalStorefrontStudioDocument();
  const shippingOptionId = useId();
  const pickupOptionId = useId();
  const [saving, setSaving] = useState(false);

  const title = useMemo(() => {
    if (showShipping && !showPickup) {
      return "Shipping";
    }
    if (!showShipping && showPickup) {
      return "Pickup";
    }
    return "Checkout settings";
  }, [showPickup, showShipping]);

  if (!document) {
    return null;
  }

  const studioDocument = document;
  const settings = ensureSettingsDraft(studioDocument.settingsDraft);

  async function handleSave() {
    setSaving(true);

    try {
      const response = await fetch(buildStoreScopedApiPath("/api/stores/settings", storeSlug), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutEnableFlatRateShipping: settings.checkout_enable_flat_rate_shipping ?? true,
          checkoutFlatRateShippingLabel: settings.checkout_flat_rate_shipping_label?.trim() || null,
          checkoutFlatRateShippingFeeCents: settings.checkout_flat_rate_shipping_fee_cents ?? 0,
          checkoutEnableLocalPickup: settings.checkout_enable_local_pickup ?? false,
          checkoutLocalPickupLabel: settings.checkout_local_pickup_label?.trim() || null,
          checkoutLocalPickupFeeCents: settings.checkout_local_pickup_fee_cents ?? 0,
          checkoutAllowOrderNote: settings.checkout_allow_order_note ?? false,
          checkoutOrderNotePrompt: settings.checkout_order_note_prompt?.trim() || null
        })
      });
      const payload = (await response.json()) as StoreSettingsResponse;

      if (!response.ok || !payload.settings) {
        throw new Error(payload.error ?? "Unable to save fulfillment settings.");
      }

      studioDocument.commitSettingsPatch({
        checkout_enable_flat_rate_shipping: payload.settings.checkout_enable_flat_rate_shipping ?? settings.checkout_enable_flat_rate_shipping ?? true,
        checkout_flat_rate_shipping_label: payload.settings.checkout_flat_rate_shipping_label ?? (settings.checkout_flat_rate_shipping_label?.trim() || "Shipping"),
        checkout_flat_rate_shipping_fee_cents: payload.settings.checkout_flat_rate_shipping_fee_cents ?? settings.checkout_flat_rate_shipping_fee_cents ?? 0,
        checkout_enable_local_pickup: payload.settings.checkout_enable_local_pickup ?? settings.checkout_enable_local_pickup ?? false,
        checkout_local_pickup_label: payload.settings.checkout_local_pickup_label ?? (settings.checkout_local_pickup_label?.trim() || "Local pickup"),
        checkout_local_pickup_fee_cents: payload.settings.checkout_local_pickup_fee_cents ?? settings.checkout_local_pickup_fee_cents ?? 0,
        checkout_allow_order_note: payload.settings.checkout_allow_order_note ?? settings.checkout_allow_order_note ?? false,
        checkout_order_note_prompt:
          payload.settings.checkout_order_note_prompt ??
          (settings.checkout_order_note_prompt?.trim() || "Add any special requests for your order.")
      });

      notify.success("Checkout and fulfillment settings saved.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Unable to save fulfillment settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-white p-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">
          Buyer-facing delivery, pickup-offer, and checkout-form controls belong in Studio. Operational pickup logistics stay on the Pickup settings page.
        </p>
      </div>

      {showShipping ? (
        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-3">
          <FormField label="Show shipping option" inputId={shippingOptionId}>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-white px-3 py-2">
              <p className="text-sm text-muted-foreground">Display the flat-rate shipping option during checkout.</p>
              <Switch
                id={shippingOptionId}
                checked={Boolean(settings.checkout_enable_flat_rate_shipping ?? true)}
                onChange={({ target }) =>
                  studioDocument.setSettingsDraft((current) => ({
                    ...ensureSettingsDraft(current),
                    checkout_enable_flat_rate_shipping: target.checked
                  }))
                }
              />
            </div>
          </FormField>

          {settings.checkout_enable_flat_rate_shipping ?? true ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Shipping label">
                <Input
                  value={settings.checkout_flat_rate_shipping_label ?? ""}
                  onChange={(event) =>
                    studioDocument.setSettingsDraft((current) => ({
                      ...ensureSettingsDraft(current),
                      checkout_flat_rate_shipping_label: event.target.value
                    }))
                  }
                  placeholder="Shipping"
                />
              </FormField>
              <FormField label="Shipping fee (cents)">
                <Input
                  type="number"
                  min={0}
                  value={settings.checkout_flat_rate_shipping_fee_cents ?? 0}
                  onChange={(event) =>
                    studioDocument.setSettingsDraft((current) => ({
                      ...ensureSettingsDraft(current),
                      checkout_flat_rate_shipping_fee_cents: coerceMoneyInput(event.target.value)
                    }))
                  }
                />
              </FormField>
            </div>
          ) : null}
        </div>
      ) : null}

      {showPickup ? (
        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-3">
          <FormField label="Show local pickup option" inputId={pickupOptionId}>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-white px-3 py-2">
              <p className="text-sm text-muted-foreground">Offer pickup in checkout when your operational pickup settings allow it.</p>
              <Switch
                id={pickupOptionId}
                checked={Boolean(settings.checkout_enable_local_pickup)}
                onChange={({ target }) =>
                  studioDocument.setSettingsDraft((current) => ({
                    ...ensureSettingsDraft(current),
                    checkout_enable_local_pickup: target.checked
                  }))
                }
              />
            </div>
          </FormField>

          {settings.checkout_enable_local_pickup ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Pickup label">
                <Input
                  value={settings.checkout_local_pickup_label ?? ""}
                  onChange={(event) =>
                    studioDocument.setSettingsDraft((current) => ({
                      ...ensureSettingsDraft(current),
                      checkout_local_pickup_label: event.target.value
                    }))
                  }
                  placeholder="Local pickup"
                />
              </FormField>
              <FormField label="Pickup fee (cents)">
                <Input
                  type="number"
                  min={0}
                  value={settings.checkout_local_pickup_fee_cents ?? 0}
                  onChange={(event) =>
                    studioDocument.setSettingsDraft((current) => ({
                      ...ensureSettingsDraft(current),
                      checkout_local_pickup_fee_cents: coerceMoneyInput(event.target.value)
                    }))
                  }
                />
              </FormField>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Need to change pickup locations, hours, blackout windows, radius rules, or buyer scheduling logic?{" "}
            <Link href={`/dashboard/stores/${storeSlug}/store-settings/fulfillment`} className="font-medium text-primary underline-offset-4 hover:underline">
              Open fulfillment settings
            </Link>
            .
          </p>
        </div>
      ) : null}

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => void handleSave()}
        disabled={saving || !studioDocument.isSettingsDirty}
      >
        {saving ? "Saving checkout settings..." : "Save checkout settings"}
      </Button>
    </div>
  );
}
