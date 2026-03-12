"use client";

import { getEditorValueAtPath } from "@/lib/store-editor/object-path";
import type { StorefrontBranding, StorefrontSettings } from "@/lib/storefront/runtime";

export function getString(section: Record<string, unknown>, path: string, fallback = "") {
  const value = getEditorValueAtPath(section, path);
  return typeof value === "string" ? value : fallback;
}

export function getBoolean(section: Record<string, unknown>, path: string, fallback = false) {
  const value = getEditorValueAtPath(section, path);
  return typeof value === "boolean" ? value : fallback;
}

export function getNumber(section: Record<string, unknown>, path: string, fallback = 0) {
  const value = getEditorValueAtPath(section, path);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function ensureStorefrontBrandingDraft(current: StorefrontBranding): NonNullable<StorefrontBranding> {
  return (
    current ?? {
      logo_path: null,
      favicon_path: null,
      apple_touch_icon_path: null,
      og_image_path: null,
      twitter_image_path: null,
      primary_color: "#0F7B84",
      accent_color: "#1AA3A8",
      theme_json: {}
    }
  );
}

export function ensureStorefrontSettingsDraft(current: StorefrontSettings): NonNullable<StorefrontSettings> {
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
