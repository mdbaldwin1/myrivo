import { describe, expect, test } from "vitest";
import { createDefaultStoreExperienceContent } from "@/lib/store-experience/content";
import { validateStorefrontStudio } from "@/lib/storefront/studio-validation";
import { createStorefrontRuntime } from "@/lib/storefront/runtime";

describe("storefront studio validation", () => {
  test("reports missing storefront-facing essentials", () => {
    const runtime = createStorefrontRuntime({
      store: { id: "store-1", name: "Olive Mercantile", slug: "olive-mercantile" },
      viewer: { isAuthenticated: true, canManageStore: true },
      branding: null,
      settings: {
        support_email: null,
        fulfillment_message: null,
        shipping_policy: null,
        return_policy: null,
        announcement: null,
        seo_title: null,
        seo_description: null,
        footer_tagline: null,
        footer_note: null,
        instagram_url: null,
        facebook_url: null,
        tiktok_url: null,
        storefront_copy_json: null,
        email_capture_enabled: true,
        email_capture_heading: null,
        email_capture_description: null,
        email_capture_success_message: null,
        checkout_enable_local_pickup: true,
        checkout_local_pickup_label: null,
        checkout_local_pickup_fee_cents: 0,
        checkout_enable_flat_rate_shipping: true,
        checkout_flat_rate_shipping_label: null,
        checkout_flat_rate_shipping_fee_cents: 0,
        checkout_allow_order_note: true,
        checkout_order_note_prompt: null
      },
      experienceContent: {
        ...createDefaultStoreExperienceContent(),
        home: {
          hero: {
            headline: ""
          },
          visibility: {
            showContentBlocks: true
          },
          contentBlocks: []
        }
      },
      contentBlocks: [],
      products: [],
      mode: "studio",
      surface: "home"
    });

    const issues = validateStorefrontStudio(runtime);

    expect(issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        "home-content-blocks",
        "policies-support-email",
        "policies-shipping-policy",
        "policies-return-policy",
        "emails-capture-heading",
        "settings-shipping-label",
        "settings-pickup-label",
        "settings-order-note-prompt",
        "settings-seo-title"
      ])
    );
  });
});
