import { describe, expect, test } from "vitest";
import { createDefaultStoreExperienceContent } from "@/lib/store-experience/content";
import { DEFAULT_STOREFRONT_COPY } from "@/lib/storefront/copy";
import { createStorefrontRuntime } from "@/lib/storefront/runtime";
import { DEFAULT_STOREFRONT_THEME_CONFIG } from "@/lib/theme/storefront-theme";

describe("storefront runtime", () => {
  test("builds a live runtime with resolved theme and copy defaults", () => {
    const runtime = createStorefrontRuntime({
      store: {
        id: "store-1",
        name: "Olive Mercantile",
        slug: "olive-mercantile"
      },
      viewer: {
        isAuthenticated: false,
        canManageStore: false
      },
      branding: null,
      settings: null,
      experienceContent: createDefaultStoreExperienceContent(),
      contentBlocks: [],
      products: [],
      surface: "home"
    });

    expect(runtime.mode).toBe("live");
    expect(runtime.surface).toBe("home");
    expect(runtime.themeConfig.pageWidth).toBe(DEFAULT_STOREFRONT_THEME_CONFIG.pageWidth);
    expect(runtime.themeConfig.productGridColumns).toBe(DEFAULT_STOREFRONT_THEME_CONFIG.productGridColumns);
    expect(runtime.themeConfig.heroHeadline).toBe(DEFAULT_STOREFRONT_THEME_CONFIG.heroHeadline);
    expect(runtime.themeConfig.showPolicyStrip).toBe(DEFAULT_STOREFRONT_THEME_CONFIG.showPolicyStrip);
    expect(runtime.copy.nav.home).toBe(DEFAULT_STOREFRONT_COPY.nav.home);
    expect(runtime.analytics.collectionEnabled).toBe(false);
    expect(runtime.analytics.dashboardEnabled).toBe(false);
  });

  test("resolves theme and copy overrides from storefront configuration", () => {
    const runtime = createStorefrontRuntime({
      store: {
        id: "store-2",
        name: "Juniper Studio",
        slug: "juniper-studio"
      },
      viewer: {
        isAuthenticated: true,
        canManageStore: true
      },
      analytics: {
        planKey: "standard",
        planAllowsAnalytics: true,
        collectionEnabled: true,
        dashboardEnabled: true
      },
      branding: {
        logo_path: "/logo.png",
        primary_color: "#112233",
        accent_color: "#445566",
        theme_json: {
          heroHeadline: "Built in runtime",
          productGridColumns: 4
        }
      },
      settings: {
        support_email: "support@example.com",
        fulfillment_message: "Ships in 2 days",
        shipping_policy: null,
        return_policy: null,
        announcement: "Free shipping over $50",
        footer_tagline: null,
        footer_note: null,
        instagram_url: null,
        facebook_url: null,
        tiktok_url: null,
        storefront_copy_json: {
          nav: {
            home: "Start"
          }
        }
      },
      experienceContent: createDefaultStoreExperienceContent(),
      contentBlocks: [],
      products: [],
      mode: "studio",
      surface: "products"
    });

    expect(runtime.mode).toBe("studio");
    expect(runtime.surface).toBe("products");
    expect(runtime.themeConfig.heroHeadline).toBe("Built in runtime");
    expect(runtime.themeConfig.productGridColumns).toBe(4);
    expect(runtime.copy.nav.home).toBe("Start");
    expect(runtime.copy.nav.products).toBe(DEFAULT_STOREFRONT_COPY.nav.products);
    expect(runtime.analytics.collectionEnabled).toBe(true);
  });
});
