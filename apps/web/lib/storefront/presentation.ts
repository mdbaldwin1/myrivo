import { mapStoreExperienceContentRow } from "@/lib/store-experience/content";
import { deepMerge, isRecord, mergeStorefrontCopy } from "@/lib/store-experience/merge";
import { resolveStorefrontCopy, type StorefrontCopyConfig } from "@/lib/storefront/copy";
import type { StorefrontContentBlock, StorefrontRuntime, StorefrontSettings } from "@/lib/storefront/runtime";
import { resolveStorefrontThemeConfig, type StorefrontThemeConfig } from "@/lib/theme/storefront-theme";

function getValueAtPath(record: Record<string, unknown>, key: string): unknown {
  return key.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[part];
  }, record);
}

function getString(record: Record<string, unknown>, key: string, fallback: string | null = null) {
  const value = getValueAtPath(record, key);
  return typeof value === "string" ? value : fallback;
}

function getBoolean(record: Record<string, unknown>, key: string, fallback: boolean) {
  const value = getValueAtPath(record, key);
  return typeof value === "boolean" ? value : fallback;
}

function getNumber(record: Record<string, unknown>, key: string, fallback: number) {
  const value = getValueAtPath(record, key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeContentBlocks(input: unknown): StorefrontContentBlock[] | null {
  if (!Array.isArray(input)) {
    return null;
  }

  return input.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }

    const block = entry as Record<string, unknown>;
    return [
      {
        id: String(block.id ?? `block-${index + 1}`),
        sort_order: typeof block.sortOrder === "number" ? block.sortOrder : index,
        eyebrow: typeof block.eyebrow === "string" ? block.eyebrow : null,
        title: typeof block.title === "string" ? block.title : "",
        body: typeof block.body === "string" ? block.body : "",
        cta_label: typeof block.ctaLabel === "string" ? block.ctaLabel : null,
        cta_url: typeof block.ctaUrl === "string" ? block.ctaUrl : null,
        is_active: typeof block.isActive === "boolean" ? block.isActive : true
      }
    ];
  });
}

function buildThemeConfig(runtime: StorefrontRuntime): StorefrontThemeConfig {
  const sectionedContent = mapStoreExperienceContentRow({
    store_id: runtime.store.id,
    home_json: runtime.experienceContent.home,
    products_page_json: runtime.experienceContent.productsPage,
    about_page_json: runtime.experienceContent.aboutPage,
    policies_page_json: runtime.experienceContent.policiesPage,
    cart_page_json: runtime.experienceContent.cartPage,
    order_summary_page_json: runtime.experienceContent.orderSummaryPage,
    emails_json: runtime.experienceContent.emails
  });

  const homeSection = sectionedContent.home;
  const productsSection = sectionedContent.productsPage;
  const homeHero = isRecord(homeSection.hero) ? homeSection.hero : {};
  const homeVisibility = isRecord(homeSection.visibility) ? homeSection.visibility : {};
  const productsVisibility = isRecord(productsSection.visibility) ? productsSection.visibility : {};
  const productsLayout = isRecord(productsSection.layout) ? productsSection.layout : {};
  const productsCards = isRecord(productsSection.productCards) ? productsSection.productCards : {};
  const brandingThemeJson = isRecord(runtime.branding?.theme_json) ? runtime.branding.theme_json : {};

  const resolvedHomeShowContentBlocks = getBoolean(
    homeVisibility,
    "showContentBlocks",
    getBoolean(brandingThemeJson, "homeShowContentBlocks", getBoolean(brandingThemeJson, "showContentBlocks", true))
  );

  const overrides: Record<string, unknown> = {
    heroLayout: getString(homeHero, "layout", getString(brandingThemeJson, "heroLayout", "split")) ?? "split",
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
    heroImageSize: getString(homeHero, "imageSize", getString(brandingThemeJson, "heroImageSize", "medium")) ?? "medium",
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
    productsFilterLayout: getString(productsLayout, "filterLayout", getString(brandingThemeJson, "productsFilterLayout", "sidebar")) ?? "sidebar",
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
    reviewsItemsPerPage: getNumber(productsSection, "reviews.itemsPerPage", getNumber(brandingThemeJson, "reviewsItemsPerPage", 10)),
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

  return resolveStorefrontThemeConfig({
    ...brandingThemeJson,
    ...overrides
  });
}

function buildCopy(runtime: StorefrontRuntime): StorefrontCopyConfig {
  return resolveStorefrontCopy(
    mergeStorefrontCopy((runtime.settings?.storefront_copy_json ?? {}) as Record<string, unknown>, [
      isRecord(runtime.experienceContent.home.copy) ? runtime.experienceContent.home.copy : {},
      isRecord(runtime.experienceContent.productsPage.copy) ? runtime.experienceContent.productsPage.copy : {},
      isRecord(runtime.experienceContent.aboutPage.copy) ? runtime.experienceContent.aboutPage.copy : {},
      isRecord(runtime.experienceContent.policiesPage.copy) ? runtime.experienceContent.policiesPage.copy : {},
      isRecord(runtime.experienceContent.cartPage.copy) ? runtime.experienceContent.cartPage.copy : {},
      isRecord(runtime.experienceContent.orderSummaryPage.copy) ? runtime.experienceContent.orderSummaryPage.copy : {},
      isRecord(runtime.experienceContent.emails.copy) ? runtime.experienceContent.emails.copy : {}
    ])
  );
}

function buildSettings(runtime: StorefrontRuntime): StorefrontSettings {
  const current = runtime.settings;
  if (!current) {
    return current;
  }

  return {
    ...current,
    support_email: getString(runtime.experienceContent.policiesPage, "supportEmail", current.support_email ?? null),
    fulfillment_message: getString(runtime.experienceContent.home, "fulfillmentMessage", current.fulfillment_message ?? null),
    shipping_policy: getString(runtime.experienceContent.policiesPage, "shippingPolicy", current.shipping_policy ?? null),
    return_policy: getString(runtime.experienceContent.policiesPage, "returnPolicy", current.return_policy ?? null),
    announcement: getString(runtime.experienceContent.home, "announcement", current.announcement ?? null),
    about_article_html: getString(runtime.experienceContent.aboutPage, "aboutArticleHtml", current.about_article_html ?? null),
    about_sections: Array.isArray(runtime.experienceContent.aboutPage.aboutSections)
      ? runtime.experienceContent.aboutPage.aboutSections
      : (current.about_sections ?? []),
    policy_faqs: Array.isArray(runtime.experienceContent.policiesPage.policyFaqs)
      ? runtime.experienceContent.policiesPage.policyFaqs.map((faq) =>
          isRecord(faq)
            ? {
                id: typeof faq.id === "string" ? faq.id : "",
                question: typeof faq.question === "string" ? faq.question : "",
                answer: typeof faq.answer === "string" ? faq.answer : "",
                sort_order: typeof faq.sortOrder === "number" ? faq.sortOrder : 0,
                is_active: typeof faq.isActive === "boolean" ? faq.isActive : true
              }
            : faq
        )
      : (current.policy_faqs ?? []),
    storefront_copy_json: deepMerge((current.storefront_copy_json ?? {}) as Record<string, unknown>, {
      ...(isRecord(runtime.experienceContent.home.copy) ? runtime.experienceContent.home.copy : {}),
      ...(isRecord(runtime.experienceContent.productsPage.copy) ? runtime.experienceContent.productsPage.copy : {}),
      ...(isRecord(runtime.experienceContent.aboutPage.copy) ? runtime.experienceContent.aboutPage.copy : {}),
      ...(isRecord(runtime.experienceContent.policiesPage.copy) ? runtime.experienceContent.policiesPage.copy : {}),
      ...(isRecord(runtime.experienceContent.cartPage.copy) ? runtime.experienceContent.cartPage.copy : {}),
      ...(isRecord(runtime.experienceContent.orderSummaryPage.copy) ? runtime.experienceContent.orderSummaryPage.copy : {}),
      ...(isRecord(runtime.experienceContent.emails.copy) ? runtime.experienceContent.emails.copy : {})
    })
  };
}

function buildContentBlocks(runtime: StorefrontRuntime): StorefrontContentBlock[] {
  return normalizeContentBlocks(runtime.experienceContent.home.contentBlocks) ?? runtime.contentBlocks;
}

export function resolveStorefrontPresentation(runtime: StorefrontRuntime) {
  return {
    themeConfig: buildThemeConfig(runtime),
    copy: buildCopy(runtime),
    settings: buildSettings(runtime),
    contentBlocks: buildContentBlocks(runtime)
  };
}
