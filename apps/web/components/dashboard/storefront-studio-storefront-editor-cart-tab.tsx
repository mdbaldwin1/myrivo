"use client";

import * as React from "react";
import { useId } from "react";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { StorefrontStudioStorefrontEditorPanelTabContainer } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-container";
import { StorefrontStudioStorefrontEditorPanelTabSection } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-section";
import { StorefrontStudioStorefrontEditorPanelToggleRow } from "@/components/dashboard/storefront-studio-storefront-editor-panel-toggle-row";
import type { StorefrontSettings } from "@/lib/storefront/runtime";

function ensureCartSettingsDraft(current: StorefrontSettings): NonNullable<StorefrontSettings> {
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

export function StorefrontStudioStorefrontEditorCartTab() {
  const document = useOptionalStorefrontStudioDocument();
  const orderNoteToggleId = useId();

  if (!document) {
    return null;
  }

  return (
    <StorefrontStudioStorefrontEditorPanelTabContainer
      footer={
        document.isSectionSaving("cartPage") || document.isSettingsSaving
          ? "Saving cart settings..."
          : document.isSectionDirty("cartPage") || document.isSettingsDirty
            ? "Changes save automatically."
            : "All cart changes saved."
      }
    >
      <StorefrontStudioStorefrontEditorPanelTabSection title="Buyer Note">
        <StorefrontStudioStorefrontEditorPanelToggleRow
          label="Allow buyer order note"
          inputId={orderNoteToggleId}
          description="Show an optional order note field on the checkout form."
          checked={Boolean(document.settingsDraft?.checkout_allow_order_note)}
          onChange={(checked) =>
            document.setSettingsDraft((current) => ({
              ...ensureCartSettingsDraft(current),
              checkout_allow_order_note: checked
            }))
          }
        />
      </StorefrontStudioStorefrontEditorPanelTabSection>
    </StorefrontStudioStorefrontEditorPanelTabContainer>
  );
}
