import type { StoreExperienceContent } from "@/lib/store-experience/content";
import { isRecord } from "@/lib/store-experience/merge";

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

export function buildMergedStorefrontThemeJson(
  baseThemeJson: Record<string, unknown> | null | undefined,
  experienceContent: StoreExperienceContent
) {
  const homeSection = experienceContent.home;
  const productsSection = experienceContent.productsPage;
  const homeHero = isRecord(homeSection.hero) ? homeSection.hero : {};
  const homeVisibility = isRecord(homeSection.visibility) ? homeSection.visibility : {};
  const productsVisibility = isRecord(productsSection.visibility) ? productsSection.visibility : {};
  const productsLayout = isRecord(productsSection.layout) ? productsSection.layout : {};
  const productsCards = isRecord(productsSection.productCards) ? productsSection.productCards : {};
  const themeJson = isRecord(baseThemeJson) ? baseThemeJson : {};

  const resolvedHomeShowContentBlocks = getBoolean(
    homeVisibility,
    "showContentBlocks",
    getBoolean(themeJson, "homeShowContentBlocks", getBoolean(themeJson, "showContentBlocks", true))
  );

  const sectionedThemeOverrides: Record<string, unknown> = {
    heroEyebrow: getString(homeHero, "eyebrow", getString(homeHero, "heroEyebrow", "")) ?? "",
    heroHeadline: getString(homeHero, "headline", getString(homeHero, "heroHeadline", "")) ?? "",
    heroSubcopy: getString(homeHero, "subcopy", getString(homeHero, "heroSubcopy", "")) ?? "",
    heroBadgeOne: getString(homeHero, "badgeOne", getString(homeHero, "heroBadgeOne", "")) ?? "",
    heroBadgeTwo: getString(homeHero, "badgeTwo", getString(homeHero, "heroBadgeTwo", "")) ?? "",
    heroBadgeThree: getString(homeHero, "badgeThree", getString(homeHero, "heroBadgeThree", "")) ?? "",
    heroBrandDisplay: getString(homeHero, "brandDisplay", getString(themeJson, "heroBrandDisplay", "title")) ?? "title",
    heroShowLogo: getBoolean(
      homeHero,
      "showLogo",
      getString(homeHero, "brandDisplay", getString(themeJson, "heroBrandDisplay", "title")) === "logo" ||
        getString(homeHero, "brandDisplay", getString(themeJson, "heroBrandDisplay", "title")) === "logo_and_title"
    ),
    heroShowTitle: getBoolean(
      homeHero,
      "showTitle",
      getString(homeHero, "brandDisplay", getString(themeJson, "heroBrandDisplay", "title")) === "title" ||
        getString(homeHero, "brandDisplay", getString(themeJson, "heroBrandDisplay", "title")) === "logo_and_title"
    ),
    showPolicyStrip: getBoolean(homeVisibility, "showPolicyStrip", getBoolean(themeJson, "showPolicyStrip", true)),
    showContentBlocks: resolvedHomeShowContentBlocks,
    homeShowHero: getBoolean(homeVisibility, "showHero", getBoolean(themeJson, "homeShowHero", true)),
    homeShowContentBlocks: resolvedHomeShowContentBlocks,
    homeShowFeaturedProducts: getBoolean(
      homeVisibility,
      "showFeaturedProducts",
      getBoolean(themeJson, "homeShowFeaturedProducts", true)
    ),
    homeFeaturedProductsLimit: getNumber(
      homeVisibility,
      "featuredProductsLimit",
      getNumber(themeJson, "homeFeaturedProductsLimit", 6)
    ),
    productsShowSearch: getBoolean(productsVisibility, "showSearch", getBoolean(themeJson, "productsShowSearch", true)),
    productsShowSort: getBoolean(productsVisibility, "showSort", getBoolean(themeJson, "productsShowSort", true)),
    productsShowAvailability: getBoolean(
      productsVisibility,
      "showAvailability",
      getBoolean(themeJson, "productsShowAvailability", true)
    ),
    productsShowOptionFilters: getBoolean(
      productsVisibility,
      "showOptionFilters",
      getBoolean(themeJson, "productsShowOptionFilters", true)
    ),
    productsFilterLayout: getString(productsLayout, "filterLayout", getString(themeJson, "productsFilterLayout", "sidebar")) ?? "sidebar",
    productsFiltersDefaultOpen: getBoolean(
      productsLayout,
      "filtersDefaultOpen",
      getBoolean(themeJson, "productsFiltersDefaultOpen", false)
    ),
    productGridColumns: getNumber(productsLayout, "gridColumns", getNumber(themeJson, "productGridColumns", 3)),
    productCardShowDescription: getBoolean(
      productsCards,
      "showDescription",
      getBoolean(themeJson, "productCardShowDescription", true)
    ),
    productCardDescriptionLines: getNumber(
      productsCards,
      "descriptionLines",
      getNumber(themeJson, "productCardDescriptionLines", 2)
    ),
    productCardShowFeaturedBadge: getBoolean(
      productsCards,
      "showFeaturedBadge",
      getBoolean(themeJson, "productCardShowFeaturedBadge", true)
    ),
    productCardShowAvailability: getBoolean(
      productsCards,
      "showAvailability",
      getBoolean(themeJson, "productCardShowAvailability", true)
    ),
    productCardShowQuickAdd: getBoolean(productsCards, "showQuickAdd", getBoolean(themeJson, "productCardShowQuickAdd", true)),
    productCardImageHoverZoom: getBoolean(
      productsCards,
      "imageHoverZoom",
      getBoolean(themeJson, "productCardImageHoverZoom", true)
    ),
    productCardShowCarouselArrows: getBoolean(
      productsCards,
      "showCarouselArrows",
      getBoolean(themeJson, "productCardShowCarouselArrows", true)
    ),
    productCardShowCarouselDots: getBoolean(
      productsCards,
      "showCarouselDots",
      getBoolean(themeJson, "productCardShowCarouselDots", true)
    ),
    productCardImageFit: getString(productsCards, "imageFit", getString(themeJson, "productCardImageFit", "cover")) ?? "cover",
    reviewsEnabled: getBoolean(productsSection, "reviews.enabled", getBoolean(themeJson, "reviewsEnabled", true)),
    reviewsShowOnHome: getBoolean(productsSection, "reviews.showOnHome", getBoolean(themeJson, "reviewsShowOnHome", true)),
    reviewsShowOnProductDetail: getBoolean(
      productsSection,
      "reviews.showOnProductDetail",
      getBoolean(themeJson, "reviewsShowOnProductDetail", true)
    ),
    reviewsFormEnabled: getBoolean(productsSection, "reviews.formEnabled", getBoolean(themeJson, "reviewsFormEnabled", true)),
    reviewsDefaultSort: getString(productsSection, "reviews.defaultSort", getString(themeJson, "reviewsDefaultSort", "newest")) ?? "newest",
    reviewsItemsPerPage: getNumber(productsSection, "reviews.itemsPerPage", getNumber(themeJson, "reviewsItemsPerPage", 10)),
    reviewsShowVerifiedBadge: getBoolean(
      productsSection,
      "reviews.showVerifiedBadge",
      getBoolean(themeJson, "reviewsShowVerifiedBadge", true)
    ),
    reviewsShowMediaGallery: getBoolean(
      productsSection,
      "reviews.showMediaGallery",
      getBoolean(themeJson, "reviewsShowMediaGallery", true)
    ),
    reviewsShowSummary: getBoolean(productsSection, "reviews.showSummary", getBoolean(themeJson, "reviewsShowSummary", true))
  };

  return {
    ...themeJson,
    ...sectionedThemeOverrides
  };
}
