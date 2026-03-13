import type { StoreExperienceContent } from "@/lib/store-experience/content";
import type { StoreAnalyticsAccess } from "@/lib/analytics/access";
import { resolveStorefrontCopy, type StorefrontCopyConfig } from "@/lib/storefront/copy";
import { resolveStorefrontThemeConfig, type StorefrontThemeConfig } from "@/lib/theme/storefront-theme";

export type StorefrontMode = "live" | "studio";

export type StorefrontSurface =
  | "home"
  | "products"
  | "productDetail"
  | "about"
  | "policies"
  | "privacy"
  | "terms"
  | "cart"
  | "checkout";

export type StorefrontViewer = {
  isAuthenticated: boolean;
  canManageStore: boolean;
};

export type StorefrontStore = {
  id: string;
  name: string;
  slug: string;
};

export type StorefrontBranding = {
  logo_path: string | null;
  favicon_path?: string | null;
  apple_touch_icon_path?: string | null;
  og_image_path?: string | null;
  twitter_image_path?: string | null;
  primary_color: string | null;
  accent_color: string | null;
  theme_json?: Record<string, unknown> | null;
} | null;

export type StorefrontSettings = {
  support_email: string | null;
  fulfillment_message: string | null;
  shipping_policy: string | null;
  return_policy: string | null;
  announcement: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_noindex?: boolean;
  seo_location_city?: string | null;
  seo_location_region?: string | null;
  seo_location_state?: string | null;
  seo_location_postal_code?: string | null;
  seo_location_country_code?: string | null;
  seo_location_address_line1?: string | null;
  seo_location_address_line2?: string | null;
  seo_location_show_full_address?: boolean;
  footer_tagline: string | null;
  footer_note: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  storefront_copy_json?: Record<string, unknown> | null;
  policy_faqs?: unknown;
  about_article_html?: string | null;
  about_sections?: unknown;
  email_capture_enabled?: boolean;
  email_capture_heading?: string | null;
  email_capture_description?: string | null;
  email_capture_success_message?: string | null;
  checkout_enable_local_pickup?: boolean | null;
  checkout_local_pickup_label?: string | null;
  checkout_local_pickup_fee_cents?: number | null;
  checkout_enable_flat_rate_shipping?: boolean | null;
  checkout_flat_rate_shipping_label?: string | null;
  checkout_flat_rate_shipping_fee_cents?: number | null;
  checkout_allow_order_note?: boolean | null;
  checkout_order_note_prompt?: string | null;
  updated_at?: string | null;
} | null;

export type StorefrontContentBlock = {
  id: string;
  sort_order: number;
  eyebrow: string | null;
  title: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
  is_active: boolean;
};

export type StorefrontVariant = {
  id: string;
  title: string | null;
  image_urls?: string[] | null;
  group_image_urls?: string[] | null;
  option_values: Record<string, string>;
  price_cents: number;
  inventory_qty: number;
  is_made_to_order: boolean;
  is_default: boolean;
  status: "active" | "archived";
  sort_order: number;
  created_at: string;
};

export type StorefrontProduct = {
  id: string;
  title: string;
  description: string;
  slug: string;
  image_urls: string[];
  image_alt_text: string | null;
  seo_title: string | null;
  seo_description: string | null;
  is_featured: boolean;
  created_at: string;
  price_cents: number;
  inventory_qty: number;
  product_variants: StorefrontVariant[];
  product_option_axes?: Array<{
    id: string;
    name: string;
    sort_order: number;
    is_required: boolean;
    product_option_values: Array<{
      id: string;
      value: string;
      sort_order: number;
      is_active: boolean;
    }>;
  }>;
};

export type StorefrontData = {
  store: StorefrontStore;
  viewer: StorefrontViewer;
  analytics: StoreAnalyticsAccess;
  branding: StorefrontBranding;
  settings: StorefrontSettings;
  experienceContent: StoreExperienceContent;
  contentBlocks: StorefrontContentBlock[];
  products: StorefrontProduct[];
};

export type StorefrontRuntime = StorefrontData & {
  mode: StorefrontMode;
  surface: StorefrontSurface;
  themeConfig: StorefrontThemeConfig;
  copy: StorefrontCopyConfig;
};

export function createStorefrontRuntime(
  input: Omit<StorefrontData, "analytics"> & {
    analytics?: StoreAnalyticsAccess;
    mode?: StorefrontMode;
    surface: StorefrontSurface;
  }
): StorefrontRuntime {
  const themeConfig = resolveStorefrontThemeConfig(input.branding?.theme_json ?? {});
  const copy = resolveStorefrontCopy(input.settings?.storefront_copy_json ?? {});
  const analytics = input.analytics ?? {
    planKey: null,
    planAllowsAnalytics: false,
    collectionEnabled: false,
    dashboardEnabled: false
  };

  return {
    ...input,
    analytics,
    mode: input.mode ?? "live",
    themeConfig,
    copy
  };
}
