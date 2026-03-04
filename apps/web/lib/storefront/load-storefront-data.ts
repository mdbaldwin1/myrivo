import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isMissingRelationInSchemaCache } from "@/lib/supabase/error-classifiers";
import { mapStoreExperienceContentRow } from "@/lib/store-experience/content";
import { isRecord, mergeStorefrontCopy } from "@/lib/store-experience/merge";
import { resolveStoreSlugForServerRender } from "@/lib/stores/active-store";
import { resolveStoreSlugFromDomain } from "@/lib/stores/domain-store";

function getString(record: Record<string, unknown>, key: string, fallback: string | null = null) {
  const value = record[key];
  return typeof value === "string" ? value : fallback;
}

function getBoolean(record: Record<string, unknown>, key: string, fallback: boolean) {
  const value = record[key];
  return typeof value === "boolean" ? value : fallback;
}

function getNumber(record: Record<string, unknown>, key: string, fallback: number) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function loadStorefrontData(explicitStoreSlug?: string | null) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const whiteLabelStoreSlug = await resolveStoreSlugFromDomain(host);
  const singleStoreSlug = await resolveStoreSlugForServerRender(explicitStoreSlug ?? whiteLabelStoreSlug);
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

  if (store.status !== "active" && !isOwnerPreview) {
    return null;
  }

  const [
    { data: branding, error: brandingError },
    { data: settings, error: settingsError },
    { data: contentBlocks, error: contentBlocksError },
    { data: experienceContent, error: experienceContentError },
    { data: products, error: productsError }
  ] = await Promise.all([
    admin
      .from("store_branding")
      .select("logo_path,primary_color,accent_color,theme_json")
      .eq("store_id", store.id)
      .maybeSingle(),
    admin
      .from("store_settings")
      .select(
        "support_email,fulfillment_message,shipping_policy,return_policy,announcement,footer_tagline,footer_note,instagram_url,facebook_url,tiktok_url,policy_faqs,about_article_html,about_sections,storefront_copy_json,email_capture_enabled,email_capture_heading,email_capture_description,email_capture_success_message,checkout_enable_local_pickup,checkout_local_pickup_label,checkout_local_pickup_fee_cents,checkout_enable_flat_rate_shipping,checkout_flat_rate_shipping_label,checkout_flat_rate_shipping_fee_cents,checkout_allow_order_note,checkout_order_note_prompt,updated_at"
      )
      .eq("store_id", store.id)
      .maybeSingle(),
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
        "id,title,description,image_urls,is_featured,created_at,price_cents,inventory_qty,product_variants(id,title,image_urls,group_image_urls,option_values,price_cents,inventory_qty,is_made_to_order,is_default,status,sort_order,created_at),product_option_axes(id,name,sort_order,is_required,product_option_values(id,value,sort_order,is_active))"
      )
      .eq("store_id", store.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
  ]);

  if (brandingError) {
    throw new Error(brandingError.message);
  }

  if (productsError) {
    throw new Error(productsError.message);
  }

  if (settingsError && !isMissingRelationInSchemaCache(settingsError)) {
    throw new Error(settingsError.message);
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

  const homeHero = isRecord(homeSection.hero) ? homeSection.hero : {};
  const homeVisibility = isRecord(homeSection.visibility) ? homeSection.visibility : {};
  const productsVisibility = isRecord(productsSection.visibility) ? productsSection.visibility : {};
  const productsLayout = isRecord(productsSection.layout) ? productsSection.layout : {};

  const sectionedThemeOverrides: Record<string, unknown> = {
    heroEyebrow: getString(homeHero, "eyebrow", getString(homeHero, "heroEyebrow", "")) ?? "",
    heroHeadline: getString(homeHero, "headline", getString(homeHero, "heroHeadline", "")) ?? "",
    heroSubcopy: getString(homeHero, "subcopy", getString(homeHero, "heroSubcopy", "")) ?? "",
    heroBadgeOne: getString(homeHero, "badgeOne", getString(homeHero, "heroBadgeOne", "")) ?? "",
    heroBadgeTwo: getString(homeHero, "badgeTwo", getString(homeHero, "heroBadgeTwo", "")) ?? "",
    heroBadgeThree: getString(homeHero, "badgeThree", getString(homeHero, "heroBadgeThree", "")) ?? "",
    heroBrandDisplay: getString(homeHero, "brandDisplay", getString(homeHero, "heroBrandDisplay", "title")) ?? "title",
    homeShowHero: getBoolean(homeVisibility, "showHero", true),
    homeShowContentBlocks: getBoolean(homeVisibility, "showContentBlocks", true),
    homeShowFeaturedProducts: getBoolean(homeVisibility, "showFeaturedProducts", true),
    homeFeaturedProductsLimit: getNumber(homeVisibility, "featuredProductsLimit", 6),
    productsShowSearch: getBoolean(productsVisibility, "showSearch", true),
    productsShowSort: getBoolean(productsVisibility, "showSort", true),
    productsShowAvailability: getBoolean(productsVisibility, "showAvailability", true),
    productsShowOptionFilters: getBoolean(productsVisibility, "showOptionFilters", true),
    productsFilterLayout: getString(productsLayout, "filterLayout", "sidebar") ?? "sidebar",
    productsFiltersDefaultOpen: getBoolean(productsLayout, "filtersDefaultOpen", false),
    productGridColumns: getNumber(productsLayout, "gridColumns", 3)
  };

  const mergedTheme = {
    ...((branding?.theme_json ?? {}) as Record<string, unknown>),
    ...sectionedThemeOverrides
  };

  const mergedCopy = mergeStorefrontCopy((settings?.storefront_copy_json ?? {}) as Record<string, unknown>, [
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

  const resolvedSettings = settingsError
    ? null
    : {
        support_email: getString(policiesSection, "supportEmail", settings?.support_email ?? null),
        fulfillment_message: getString(homeSection, "fulfillmentMessage", settings?.fulfillment_message ?? null),
        shipping_policy: getString(policiesSection, "shippingPolicy", settings?.shipping_policy ?? null),
        return_policy: getString(policiesSection, "returnPolicy", settings?.return_policy ?? null),
        announcement: getString(homeSection, "announcement", settings?.announcement ?? null),
        footer_tagline: settings?.footer_tagline ?? null,
        footer_note: settings?.footer_note ?? null,
        instagram_url: settings?.instagram_url ?? null,
        facebook_url: settings?.facebook_url ?? null,
        tiktok_url: settings?.tiktok_url ?? null,
        policy_faqs: Array.isArray(policiesSection.policyFaqs) ? policiesSection.policyFaqs : (settings?.policy_faqs ?? []),
        about_article_html: getString(aboutSection, "aboutArticleHtml", settings?.about_article_html ?? null),
        about_sections: Array.isArray(aboutSection.aboutSections) ? aboutSection.aboutSections : (settings?.about_sections ?? []),
        storefront_copy_json: mergedCopy,
        email_capture_enabled: getBoolean(
          isRecord(emailsSection.newsletterCapture) ? emailsSection.newsletterCapture : {},
          "enabled",
          settings?.email_capture_enabled ?? false
        ),
        email_capture_heading: getString(
          isRecord(emailsSection.newsletterCapture) ? emailsSection.newsletterCapture : {},
          "heading",
          settings?.email_capture_heading ?? null
        ),
        email_capture_description: getString(
          isRecord(emailsSection.newsletterCapture) ? emailsSection.newsletterCapture : {},
          "description",
          settings?.email_capture_description ?? null
        ),
        email_capture_success_message: getString(
          isRecord(emailsSection.newsletterCapture) ? emailsSection.newsletterCapture : {},
          "successMessage",
          settings?.email_capture_success_message ?? null
        ),
        checkout_enable_local_pickup: settings?.checkout_enable_local_pickup ?? false,
        checkout_local_pickup_label: settings?.checkout_local_pickup_label ?? null,
        checkout_local_pickup_fee_cents: settings?.checkout_local_pickup_fee_cents ?? 0,
        checkout_enable_flat_rate_shipping: settings?.checkout_enable_flat_rate_shipping ?? true,
        checkout_flat_rate_shipping_label: settings?.checkout_flat_rate_shipping_label ?? null,
        checkout_flat_rate_shipping_fee_cents: settings?.checkout_flat_rate_shipping_fee_cents ?? 0,
        checkout_allow_order_note: settings?.checkout_allow_order_note ?? false,
        checkout_order_note_prompt: settings?.checkout_order_note_prompt ?? null,
        updated_at: settings?.updated_at ?? null
      };

  return {
    store,
    branding: branding
      ? {
          ...branding,
          theme_json: mergedTheme
        }
      : branding,
    settings: resolvedSettings,
    contentBlocks:
      normalizedSectionedBlocks ??
      (contentBlocksError ? [] : (contentBlocks ?? [])),
    products: products ?? []
  };
}
