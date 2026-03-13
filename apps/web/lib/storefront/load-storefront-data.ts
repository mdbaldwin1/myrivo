import { headers } from "next/headers";
import { resolveStoreAnalyticsAccessByStoreId } from "@/lib/analytics/access";
import { resolveStorePrivacyProfile } from "@/lib/privacy/store-privacy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isMissingColumnInSchemaCache, isMissingRelationInSchemaCache } from "@/lib/supabase/error-classifiers";
import { mapStoreExperienceContentRow } from "@/lib/store-experience/content";
import { isRecord, mergeStorefrontCopy } from "@/lib/store-experience/merge";
import type { StorefrontData } from "@/lib/storefront/runtime";
import { resolveStoreSlugForServerRender } from "@/lib/stores/active-store";
import { resolveStoreSlugFromDomain } from "@/lib/stores/domain-store";

function getValueAtPath(record: Record<string, unknown>, key: string): unknown {
  return key.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[part];
  }, record);
}

export function getString(record: Record<string, unknown>, key: string, fallback: string | null = null) {
  const value = getValueAtPath(record, key);
  return typeof value === "string" ? value : fallback;
}

export function getBoolean(record: Record<string, unknown>, key: string, fallback: boolean) {
  const value = getValueAtPath(record, key);
  return typeof value === "boolean" ? value : fallback;
}

export function getNumber(record: Record<string, unknown>, key: string, fallback: number) {
  const value = getValueAtPath(record, key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function loadStorefrontData(explicitStoreSlug?: string | null): Promise<StorefrontData | null> {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const whiteLabelStoreSlug = await resolveStoreSlugFromDomain(host);
  const singleStoreSlug = await resolveStoreSlugForServerRender(explicitStoreSlug ?? whiteLabelStoreSlug);
  if (!singleStoreSlug) {
    return null;
  }
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: store, error: storeError } = await admin
    .from("stores")
    .select("id,name,slug,status,owner_user_id")
    .eq("slug", singleStoreSlug)
    .maybeSingle();

  if (storeError) {
    throw new Error(storeError.message);
  }

  if (!store) {
    return null;
  }

  const isOwnerPreview = Boolean(user && user.id === store.owner_user_id);
  const isAuthenticated = Boolean(user);

  let canManageStore = false;
  if (isOwnerPreview) {
    canManageStore = true;
  } else if (user) {
    const { data: membership, error: membershipError } = await admin
      .from("store_memberships")
      .select("role,status")
      .eq("store_id", store.id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle<{ role: "customer" | "staff" | "admin" | "owner"; status: "active" | "inactive" | "invited" }>();

    if (!membershipError && membership && (membership.role === "staff" || membership.role === "admin" || membership.role === "owner")) {
      canManageStore = true;
    }
  }

  if (store.status !== "active" && !isOwnerPreview) {
    return null;
  }

  const [
    analytics,
    { data: branding, error: brandingError },
    { data: settings, error: settingsError },
    { data: privacyProfile, error: privacyProfileError },
    { data: contentBlocks, error: contentBlocksError },
    { data: experienceContent, error: experienceContentError },
    { data: products, error: productsError }
  ] = await Promise.all([
    resolveStoreAnalyticsAccessByStoreId(admin, store.id),
    admin
      .from("store_branding")
      .select("logo_path,favicon_path,apple_touch_icon_path,og_image_path,twitter_image_path,primary_color,accent_color,theme_json")
      .eq("store_id", store.id)
      .maybeSingle(),
    admin
      .from("store_settings")
      .select(
        "support_email,fulfillment_message,shipping_policy,return_policy,announcement,seo_title,seo_description,seo_noindex,seo_location_city,seo_location_region,seo_location_state,seo_location_postal_code,seo_location_country_code,seo_location_address_line1,seo_location_address_line2,seo_location_show_full_address,footer_tagline,footer_note,instagram_url,facebook_url,tiktok_url,policy_faqs,about_article_html,about_sections,storefront_copy_json,email_capture_enabled,email_capture_heading,email_capture_description,email_capture_success_message,checkout_enable_local_pickup,checkout_local_pickup_label,checkout_local_pickup_fee_cents,checkout_enable_flat_rate_shipping,checkout_flat_rate_shipping_label,checkout_flat_rate_shipping_fee_cents,checkout_allow_order_note,checkout_order_note_prompt,updated_at"
      )
      .eq("store_id", store.id)
      .maybeSingle(),
    admin.from("store_privacy_profiles").select("*").eq("store_id", store.id).maybeSingle(),
    admin
      .from("store_content_blocks")
      .select("id,sort_order,eyebrow,title,body,cta_label,cta_url,is_active")
      .eq("store_id", store.id)
      .order("sort_order", { ascending: true }),
    admin
      .from("store_experience_content")
      .select("store_id,home_json,products_page_json,about_page_json,policies_page_json,cart_page_json,order_summary_page_json,emails_json")
      .eq("store_id", store.id)
      .maybeSingle(),
    admin
      .from("products")
      .select(
        "id,title,description,slug,image_urls,image_alt_text,seo_title,seo_description,is_featured,created_at,price_cents,inventory_qty,product_variants(id,title,image_urls,group_image_urls,option_values,price_cents,inventory_qty,is_made_to_order,is_default,status,sort_order,created_at),product_option_axes(id,name,sort_order,is_required,product_option_values(id,value,sort_order,is_active))"
      )
      .eq("store_id", store.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
  ]);

  if (brandingError) {
    throw new Error(brandingError.message);
  }

  let resolvedProducts = products;
  let resolvedProductsError = productsError;
  let resolvedSettings = settings;
  let resolvedSettingsError = settingsError;
  if (
    isMissingColumnInSchemaCache(productsError, "slug") ||
    isMissingColumnInSchemaCache(productsError, "image_alt_text") ||
    isMissingColumnInSchemaCache(productsError, "seo_title") ||
    isMissingColumnInSchemaCache(productsError, "seo_description")
  ) {
    const legacyProducts = await admin
      .from("products")
      .select(
        "id,title,description,image_urls,is_featured,created_at,price_cents,inventory_qty,product_variants(id,title,image_urls,group_image_urls,option_values,price_cents,inventory_qty,is_made_to_order,is_default,status,sort_order,created_at),product_option_axes(id,name,sort_order,is_required,product_option_values(id,value,sort_order,is_active))"
      )
      .eq("store_id", store.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    resolvedProducts = (legacyProducts.data ?? []).map((product) => ({
      ...product,
      slug: product.id,
      image_alt_text: null,
      seo_title: null,
      seo_description: null
    }));
    resolvedProductsError = legacyProducts.error;
  }

  if (resolvedProductsError) {
    throw new Error(resolvedProductsError.message);
  }

  if (
    isMissingColumnInSchemaCache(settingsError, "seo_title") ||
    isMissingColumnInSchemaCache(settingsError, "seo_description") ||
    isMissingColumnInSchemaCache(settingsError, "seo_noindex") ||
    isMissingColumnInSchemaCache(settingsError, "seo_location_city") ||
    isMissingColumnInSchemaCache(settingsError, "seo_location_show_full_address")
  ) {
    const legacySettings = await admin
      .from("store_settings")
      .select(
        "support_email,fulfillment_message,shipping_policy,return_policy,announcement,footer_tagline,footer_note,instagram_url,facebook_url,tiktok_url,policy_faqs,about_article_html,about_sections,storefront_copy_json,email_capture_enabled,email_capture_heading,email_capture_description,email_capture_success_message,checkout_enable_local_pickup,checkout_local_pickup_label,checkout_local_pickup_fee_cents,checkout_enable_flat_rate_shipping,checkout_flat_rate_shipping_label,checkout_flat_rate_shipping_fee_cents,checkout_allow_order_note,checkout_order_note_prompt,updated_at"
      )
      .eq("store_id", store.id)
      .maybeSingle();
    resolvedSettings = legacySettings.data
      ? {
          ...legacySettings.data,
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
          seo_location_show_full_address: false
        }
      : null;
    resolvedSettingsError = legacySettings.error;
  }

  if (resolvedSettingsError && !isMissingRelationInSchemaCache(resolvedSettingsError)) {
    throw new Error(resolvedSettingsError.message);
  }

  if (privacyProfileError && !isMissingRelationInSchemaCache(privacyProfileError)) {
    throw new Error(privacyProfileError.message);
  }

  if (contentBlocksError && !isMissingRelationInSchemaCache(contentBlocksError)) {
    throw new Error(contentBlocksError.message);
  }

  if (experienceContentError && !isMissingRelationInSchemaCache(experienceContentError)) {
    throw new Error(experienceContentError.message);
  }

  const sectionedContent = mapStoreExperienceContentRow(experienceContentError ? null : experienceContent);
  const homeSection = sectionedContent.home;
  const productsSection = sectionedContent.productsPage;
  const aboutSection = sectionedContent.aboutPage;
  const policiesSection = sectionedContent.policiesPage;
  const cartSection = sectionedContent.cartPage;
  const orderSummarySection = sectionedContent.orderSummaryPage;
  const emailsSection = sectionedContent.emails;
  const brandingThemeJson = isRecord(branding?.theme_json) ? branding.theme_json : {};

  const homeHero = isRecord(homeSection.hero) ? homeSection.hero : {};
  const homeVisibility = isRecord(homeSection.visibility) ? homeSection.visibility : {};
  const productsVisibility = isRecord(productsSection.visibility) ? productsSection.visibility : {};
  const productsLayout = isRecord(productsSection.layout) ? productsSection.layout : {};
  const productsCards = isRecord(productsSection.productCards) ? productsSection.productCards : {};

  const resolvedHomeShowContentBlocks = getBoolean(
    homeVisibility,
    "showContentBlocks",
    getBoolean(brandingThemeJson, "homeShowContentBlocks", getBoolean(brandingThemeJson, "showContentBlocks", true))
  );

  const sectionedThemeOverrides: Record<string, unknown> = {
    heroEyebrow: getString(homeHero, "eyebrow", getString(homeHero, "heroEyebrow", "")) ?? "",
    heroHeadline: getString(homeHero, "headline", getString(homeHero, "heroHeadline", "")) ?? "",
    heroSubcopy: getString(homeHero, "subcopy", getString(homeHero, "heroSubcopy", "")) ?? "",
    heroBadgeOne: getString(homeHero, "badgeOne", getString(homeHero, "heroBadgeOne", "")) ?? "",
    heroBadgeTwo: getString(homeHero, "badgeTwo", getString(homeHero, "heroBadgeTwo", "")) ?? "",
    heroBadgeThree: getString(homeHero, "badgeThree", getString(homeHero, "heroBadgeThree", "")) ?? "",
    heroBrandDisplay: getString(homeHero, "brandDisplay", getString(homeHero, "heroBrandDisplay", "title")) ?? "title",
    heroShowLogo: getBoolean(
      homeHero,
      "showLogo",
      getString(homeHero, "brandDisplay", getString(homeHero, "heroBrandDisplay", "title")) === "logo" ||
        getString(homeHero, "brandDisplay", getString(homeHero, "heroBrandDisplay", "title")) === "logo_and_title"
    ),
    heroShowTitle: getBoolean(
      homeHero,
      "showTitle",
      getString(homeHero, "brandDisplay", getString(homeHero, "heroBrandDisplay", "title")) === "title" ||
        getString(homeHero, "brandDisplay", getString(homeHero, "heroBrandDisplay", "title")) === "logo_and_title"
    ),
    showPolicyStrip: getBoolean(homeVisibility, "showPolicyStrip", getBoolean(brandingThemeJson, "showPolicyStrip", true)),
    showContentBlocks: resolvedHomeShowContentBlocks,
    homeShowHero: getBoolean(homeVisibility, "showHero", getBoolean(brandingThemeJson, "homeShowHero", true)),
    homeShowContentBlocks: resolvedHomeShowContentBlocks,
    homeShowFeaturedProducts: getBoolean(
      homeVisibility,
      "showFeaturedProducts",
      getBoolean(brandingThemeJson, "homeShowFeaturedProducts", true)
    ),
    homeFeaturedProductsLimit: getNumber(
      homeVisibility,
      "featuredProductsLimit",
      getNumber(brandingThemeJson, "homeFeaturedProductsLimit", 6)
    ),
    productsShowSearch: getBoolean(productsVisibility, "showSearch", getBoolean(brandingThemeJson, "productsShowSearch", true)),
    productsShowSort: getBoolean(productsVisibility, "showSort", getBoolean(brandingThemeJson, "productsShowSort", true)),
    productsShowAvailability: getBoolean(
      productsVisibility,
      "showAvailability",
      getBoolean(brandingThemeJson, "productsShowAvailability", true)
    ),
    productsShowOptionFilters: getBoolean(
      productsVisibility,
      "showOptionFilters",
      getBoolean(brandingThemeJson, "productsShowOptionFilters", true)
    ),
    productsFilterLayout: getString(
      productsLayout,
      "filterLayout",
      getString(brandingThemeJson, "productsFilterLayout", "sidebar")
    ) ?? "sidebar",
    productsFiltersDefaultOpen: getBoolean(
      productsLayout,
      "filtersDefaultOpen",
      getBoolean(brandingThemeJson, "productsFiltersDefaultOpen", false)
    ),
    productGridColumns: getNumber(productsLayout, "gridColumns", getNumber(brandingThemeJson, "productGridColumns", 3)),
    productCardShowDescription: getBoolean(
      productsCards,
      "showDescription",
      getBoolean(brandingThemeJson, "productCardShowDescription", true)
    ),
    productCardDescriptionLines: getNumber(
      productsCards,
      "descriptionLines",
      getNumber(brandingThemeJson, "productCardDescriptionLines", 2)
    ),
    productCardShowFeaturedBadge: getBoolean(
      productsCards,
      "showFeaturedBadge",
      getBoolean(brandingThemeJson, "productCardShowFeaturedBadge", true)
    ),
    productCardShowAvailability: getBoolean(
      productsCards,
      "showAvailability",
      getBoolean(brandingThemeJson, "productCardShowAvailability", true)
    ),
    productCardShowQuickAdd: getBoolean(
      productsCards,
      "showQuickAdd",
      getBoolean(brandingThemeJson, "productCardShowQuickAdd", true)
    ),
    productCardImageHoverZoom: getBoolean(
      productsCards,
      "imageHoverZoom",
      getBoolean(brandingThemeJson, "productCardImageHoverZoom", true)
    ),
    productCardShowCarouselArrows: getBoolean(
      productsCards,
      "showCarouselArrows",
      getBoolean(brandingThemeJson, "productCardShowCarouselArrows", true)
    ),
    productCardShowCarouselDots: getBoolean(
      productsCards,
      "showCarouselDots",
      getBoolean(brandingThemeJson, "productCardShowCarouselDots", true)
    ),
    productCardImageFit: getString(productsCards, "imageFit", getString(brandingThemeJson, "productCardImageFit", "cover")) ?? "cover",
    reviewsEnabled: getBoolean(productsSection, "reviews.enabled", getBoolean(brandingThemeJson, "reviewsEnabled", true)),
    reviewsShowOnHome: getBoolean(productsSection, "reviews.showOnHome", getBoolean(brandingThemeJson, "reviewsShowOnHome", true)),
    reviewsShowOnProductDetail: getBoolean(
      productsSection,
      "reviews.showOnProductDetail",
      getBoolean(brandingThemeJson, "reviewsShowOnProductDetail", true)
    ),
    reviewsFormEnabled: getBoolean(productsSection, "reviews.formEnabled", getBoolean(brandingThemeJson, "reviewsFormEnabled", true)),
    reviewsDefaultSort:
      getString(productsSection, "reviews.defaultSort", getString(brandingThemeJson, "reviewsDefaultSort", "newest")) ?? "newest",
    reviewsItemsPerPage: getNumber(
      productsSection,
      "reviews.itemsPerPage",
      getNumber(brandingThemeJson, "reviewsItemsPerPage", 10)
    ),
    reviewsShowVerifiedBadge: getBoolean(
      productsSection,
      "reviews.showVerifiedBadge",
      getBoolean(brandingThemeJson, "reviewsShowVerifiedBadge", true)
    ),
    reviewsShowMediaGallery: getBoolean(
      productsSection,
      "reviews.showMediaGallery",
      getBoolean(brandingThemeJson, "reviewsShowMediaGallery", true)
    ),
    reviewsShowSummary: getBoolean(productsSection, "reviews.showSummary", getBoolean(brandingThemeJson, "reviewsShowSummary", true))
  };

  const mergedTheme = {
    ...((branding?.theme_json ?? {}) as Record<string, unknown>),
    ...sectionedThemeOverrides
  };

  const mergedCopy = mergeStorefrontCopy((resolvedSettings?.storefront_copy_json ?? {}) as Record<string, unknown>, [
    isRecord(homeSection.copy) ? homeSection.copy : {},
    isRecord(productsSection.copy) ? productsSection.copy : {},
    isRecord(aboutSection.copy) ? aboutSection.copy : {},
    isRecord(policiesSection.copy) ? policiesSection.copy : {},
    isRecord(cartSection.copy) ? cartSection.copy : {},
    isRecord(orderSummarySection.copy) ? orderSummarySection.copy : {},
    isRecord(emailsSection.copy) ? emailsSection.copy : {}
  ]);

  const sectionedContentBlocks = Array.isArray(homeSection.contentBlocks) ? homeSection.contentBlocks : null;
  const normalizedSectionedBlocks =
    sectionedContentBlocks?.flatMap((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return [];
      }
      const block = entry as Record<string, unknown>;
      return [
        {
          id: String(block.id ?? `block-${index + 1}`),
          sort_order: typeof block.sortOrder === "number" ? block.sortOrder : 0,
          eyebrow: typeof block.eyebrow === "string" ? block.eyebrow : null,
          title: typeof block.title === "string" ? block.title : "",
          body: typeof block.body === "string" ? block.body : "",
          cta_label: typeof block.ctaLabel === "string" ? block.ctaLabel : null,
          cta_url: typeof block.ctaUrl === "string" ? block.ctaUrl : null,
          is_active: typeof block.isActive === "boolean" ? block.isActive : true
        }
      ];
    }) ?? null;

  const finalSettings = resolvedSettingsError
    ? null
    : {
        support_email: getString(policiesSection, "supportEmail", resolvedSettings?.support_email ?? null),
        fulfillment_message: getString(homeSection, "fulfillmentMessage", resolvedSettings?.fulfillment_message ?? null),
        shipping_policy: getString(policiesSection, "shippingPolicy", resolvedSettings?.shipping_policy ?? null),
        return_policy: getString(policiesSection, "returnPolicy", resolvedSettings?.return_policy ?? null),
        announcement: getString(homeSection, "announcement", resolvedSettings?.announcement ?? null),
        seo_title: resolvedSettings?.seo_title ?? null,
        seo_description: resolvedSettings?.seo_description ?? null,
        seo_noindex: resolvedSettings?.seo_noindex ?? false,
        seo_location_city: resolvedSettings?.seo_location_city ?? null,
        seo_location_region: resolvedSettings?.seo_location_region ?? null,
        seo_location_state: resolvedSettings?.seo_location_state ?? null,
        seo_location_postal_code: resolvedSettings?.seo_location_postal_code ?? null,
        seo_location_country_code: resolvedSettings?.seo_location_country_code ?? null,
        seo_location_address_line1: resolvedSettings?.seo_location_address_line1 ?? null,
        seo_location_address_line2: resolvedSettings?.seo_location_address_line2 ?? null,
        seo_location_show_full_address: resolvedSettings?.seo_location_show_full_address ?? false,
        footer_tagline: resolvedSettings?.footer_tagline ?? null,
        footer_note: resolvedSettings?.footer_note ?? null,
        instagram_url: resolvedSettings?.instagram_url ?? null,
        facebook_url: resolvedSettings?.facebook_url ?? null,
        tiktok_url: resolvedSettings?.tiktok_url ?? null,
        policy_faqs: Array.isArray(policiesSection.policyFaqs) ? policiesSection.policyFaqs : (resolvedSettings?.policy_faqs ?? []),
        about_article_html: getString(aboutSection, "aboutArticleHtml", resolvedSettings?.about_article_html ?? null),
        about_sections: Array.isArray(aboutSection.aboutSections) ? aboutSection.aboutSections : (resolvedSettings?.about_sections ?? []),
        storefront_copy_json: mergedCopy,
        email_capture_enabled: getBoolean(
          isRecord(emailsSection.newsletterCapture) ? emailsSection.newsletterCapture : {},
          "enabled",
          resolvedSettings?.email_capture_enabled ?? false
        ),
        email_capture_heading: getString(
          isRecord(emailsSection.newsletterCapture) ? emailsSection.newsletterCapture : {},
          "heading",
          resolvedSettings?.email_capture_heading ?? null
        ),
        email_capture_description: getString(
          isRecord(emailsSection.newsletterCapture) ? emailsSection.newsletterCapture : {},
          "description",
          resolvedSettings?.email_capture_description ?? null
        ),
        email_capture_success_message: getString(
          isRecord(emailsSection.newsletterCapture) ? emailsSection.newsletterCapture : {},
          "successMessage",
          resolvedSettings?.email_capture_success_message ?? null
        ),
        checkout_enable_local_pickup: resolvedSettings?.checkout_enable_local_pickup ?? false,
        checkout_local_pickup_label: resolvedSettings?.checkout_local_pickup_label ?? null,
        checkout_local_pickup_fee_cents: resolvedSettings?.checkout_local_pickup_fee_cents ?? 0,
        checkout_enable_flat_rate_shipping: resolvedSettings?.checkout_enable_flat_rate_shipping ?? true,
        checkout_flat_rate_shipping_label: resolvedSettings?.checkout_flat_rate_shipping_label ?? null,
        checkout_flat_rate_shipping_fee_cents: resolvedSettings?.checkout_flat_rate_shipping_fee_cents ?? 0,
        checkout_allow_order_note: resolvedSettings?.checkout_allow_order_note ?? false,
        checkout_order_note_prompt: resolvedSettings?.checkout_order_note_prompt ?? null,
        updated_at: resolvedSettings?.updated_at ?? null
      };

  return {
    store,
    viewer: {
      isAuthenticated,
      canManageStore
    },
    analytics,
    privacyProfile: resolveStorePrivacyProfile(privacyProfileError ? null : privacyProfile, finalSettings),
    experienceContent: sectionedContent,
    branding: branding
      ? {
          ...branding,
          theme_json: mergedTheme
        }
      : branding,
    settings: finalSettings,
    contentBlocks:
      normalizedSectionedBlocks ??
      (contentBlocksError ? [] : (contentBlocks ?? [])),
    products: resolvedProducts ?? []
  };
}
