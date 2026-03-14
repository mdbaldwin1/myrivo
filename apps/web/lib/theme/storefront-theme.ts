import type { CSSProperties } from "react";

const DEFAULT_PRIMARY = "#0F7B84";
const DEFAULT_ACCENT = "#1AA3A8";
const DEFAULT_BACKGROUND = "#F5FBFB";
const DEFAULT_SURFACE = "#FFFFFF";
const DEFAULT_TEXT = "#143435";

const PAGE_WIDTH_OPTIONS = ["narrow", "standard", "wide"] as const;
const HERO_LAYOUT_OPTIONS = ["split", "centered"] as const;
const HERO_BRAND_DISPLAY_OPTIONS = ["title", "logo", "logo_and_title"] as const;
const PRODUCT_GRID_OPTIONS = [2, 3, 4] as const;
const RADIUS_OPTIONS = ["soft", "rounded", "sharp"] as const;
const CARD_STYLE_OPTIONS = ["solid", "outline", "elevated", "integrated"] as const;
const SPACING_OPTIONS = ["compact", "comfortable", "airy"] as const;
const FONT_PRESET_OPTIONS = ["classic", "modern", "clean"] as const;
const STOREFRONT_FONT_FAMILY_OPTIONS = [
  "fraunces-manrope",
  "avenir-next",
  "georgia",
  "palatino",
  "helvetica-neue",
  "trebuchet"
] as const;
const NAV_ITEM_IDS = ["home", "products", "about", "policies"] as const;
const FOOTER_ITEM_IDS = ["products", "cart", "about", "policies"] as const;
const FILTER_LAYOUT_OPTIONS = ["sidebar", "topbar"] as const;
const CTA_STYLE_OPTIONS = ["primary", "accent", "outline"] as const;
const IMAGE_FIT_OPTIONS = ["cover", "contain"] as const;
const REVIEW_SORT_OPTIONS = ["newest", "highest", "lowest"] as const;
const HEADER_LOGO_SIZE_OPTIONS = ["small", "medium", "large"] as const;
const HEADER_TITLE_SIZE_OPTIONS = ["small", "medium", "large"] as const;
const HERO_IMAGE_SIZE_OPTIONS = ["small", "medium", "large"] as const;

export type PageWidth = (typeof PAGE_WIDTH_OPTIONS)[number];
export type HeroLayout = (typeof HERO_LAYOUT_OPTIONS)[number];
export type HeroBrandDisplay = (typeof HERO_BRAND_DISPLAY_OPTIONS)[number];
export type ProductGridColumns = (typeof PRODUCT_GRID_OPTIONS)[number];
export type RadiusScale = (typeof RADIUS_OPTIONS)[number];
export type CardStyle = (typeof CARD_STYLE_OPTIONS)[number];
export type SpacingScale = (typeof SPACING_OPTIONS)[number];
export type StorefrontFontFamily = (typeof STOREFRONT_FONT_FAMILY_OPTIONS)[number];
export type NavItemId = (typeof NAV_ITEM_IDS)[number];
export type FooterItemId = (typeof FOOTER_ITEM_IDS)[number];
export type FilterLayout = (typeof FILTER_LAYOUT_OPTIONS)[number];
export type CtaStyle = (typeof CTA_STYLE_OPTIONS)[number];
export type ImageFit = (typeof IMAGE_FIT_OPTIONS)[number];
export type ReviewSort = (typeof REVIEW_SORT_OPTIONS)[number];
export type HeaderLogoSize = (typeof HEADER_LOGO_SIZE_OPTIONS)[number];
export type HeaderTitleSize = (typeof HEADER_TITLE_SIZE_OPTIONS)[number];
export type HeroImageSize = (typeof HERO_IMAGE_SIZE_OPTIONS)[number];

export type StorefrontThemeConfig = {
  pageWidth: PageWidth;
  heroLayout: HeroLayout;
  heroBrandDisplay: HeroBrandDisplay;
  heroShowLogo: boolean;
  heroShowTitle: boolean;
  heroImageSize: HeroImageSize;
  productGridColumns: ProductGridColumns;
  radiusScale: RadiusScale;
  cardStyle: CardStyle;
  spacingScale: SpacingScale;
  fontFamily: StorefrontFontFamily;
  showContentBlocks: boolean;
  showPolicyStrip: boolean;
  heroEyebrow: string;
  heroHeadline: string;
  heroSubcopy: string;
  heroBadgeOne: string;
  heroBadgeTwo: string;
  heroBadgeThree: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  headerBackgroundColor: string;
  headerForegroundColor: string;
  headerShowLogo: boolean;
  headerShowTitle: boolean;
  headerLogoSize: HeaderLogoSize;
  headerTitleSize: HeaderTitleSize;
  primaryForegroundColor: string | null;
  accentForegroundColor: string | null;
  headerNavItems: NavItemId[];
  footerNavItems: FooterItemId[];
  showFooterBackToTop: boolean;
  showFooterOwnerLogin: boolean;
  homeShowHero: boolean;
  homeShowContentBlocks: boolean;
  homeShowFeaturedProducts: boolean;
  homeFeaturedProductsLimit: number;
  productsFilterLayout: FilterLayout;
  productsFiltersDefaultOpen: boolean;
  productsShowSearch: boolean;
  productsShowSort: boolean;
  productsShowAvailability: boolean;
  productsShowOptionFilters: boolean;
  productCardShowDescription: boolean;
  productCardDescriptionLines: number;
  productCardShowFeaturedBadge: boolean;
  productCardShowAvailability: boolean;
  productCardShowQuickAdd: boolean;
  productCardImageHoverZoom: boolean;
  productCardShowCarouselArrows: boolean;
  productCardShowCarouselDots: boolean;
  productCardImageFit: ImageFit;
  primaryCtaStyle: CtaStyle;
  reviewsEnabled: boolean;
  reviewsShowOnHome: boolean;
  reviewsShowOnProductDetail: boolean;
  reviewsFormEnabled: boolean;
  reviewsDefaultSort: ReviewSort;
  reviewsItemsPerPage: number;
  reviewsShowVerifiedBadge: boolean;
  reviewsShowMediaGallery: boolean;
  reviewsShowSummary: boolean;
};

export type StorefrontThemeInput = {
  primaryColor?: string | null;
  accentColor?: string | null;
  themeConfig?: unknown;
};

export const STOREFRONT_FONT_OPTIONS: Array<{
  id: StorefrontFontFamily;
  label: string;
  previewClassName: string;
  headingStack: string;
  bodyStack: string;
}> = [
  {
    id: "fraunces-manrope",
    label: "Fraunces",
    previewClassName: "[font-family:'Fraunces','Iowan Old Style','Palatino Linotype',serif]",
    headingStack: "\"Fraunces\", \"Iowan Old Style\", \"Palatino Linotype\", serif",
    bodyStack: "\"Manrope\", \"Avenir Next\", \"Segoe UI\", sans-serif"
  },
  {
    id: "avenir-next",
    label: "Avenir Next",
    previewClassName: "[font-family:'Avenir Next','Segoe UI',sans-serif]",
    headingStack: "\"Avenir Next\", \"Segoe UI\", sans-serif",
    bodyStack: "\"Avenir Next\", \"Segoe UI\", sans-serif"
  },
  {
    id: "georgia",
    label: "Georgia",
    previewClassName: "[font-family:'Georgia','Times New Roman',serif]",
    headingStack: "\"Georgia\", \"Times New Roman\", serif",
    bodyStack: "\"Georgia\", \"Times New Roman\", serif"
  },
  {
    id: "palatino",
    label: "Palatino",
    previewClassName: "[font-family:'Palatino Linotype','Book Antiqua',Palatino,serif]",
    headingStack: "\"Palatino Linotype\", \"Book Antiqua\", Palatino, serif",
    bodyStack: "\"Palatino Linotype\", \"Book Antiqua\", Palatino, serif"
  },
  {
    id: "helvetica-neue",
    label: "Helvetica Neue",
    previewClassName: "[font-family:'Helvetica Neue',Helvetica,Arial,sans-serif]",
    headingStack: "\"Helvetica Neue\", Helvetica, Arial, sans-serif",
    bodyStack: "\"Helvetica Neue\", Helvetica, Arial, sans-serif"
  },
  {
    id: "trebuchet",
    label: "Trebuchet MS",
    previewClassName: "[font-family:'Trebuchet MS','Avenir Next','Segoe UI',sans-serif]",
    headingStack: "\"Trebuchet MS\", \"Avenir Next\", \"Segoe UI\", sans-serif",
    bodyStack: "\"Trebuchet MS\", \"Avenir Next\", \"Segoe UI\", sans-serif"
  }
];

export const DEFAULT_STOREFRONT_THEME_CONFIG: StorefrontThemeConfig = {
  pageWidth: "standard",
  heroLayout: "split",
  heroBrandDisplay: "title",
  heroShowLogo: false,
  heroShowTitle: true,
  heroImageSize: "medium",
  productGridColumns: 2,
  radiusScale: "sharp",
  cardStyle: "integrated",
  spacingScale: "comfortable",
  fontFamily: "fraunces-manrope",
  showContentBlocks: true,
  showPolicyStrip: true,
  heroEyebrow: "",
  heroHeadline: "Crafted essentials for everyday ritual.",
  heroSubcopy: "Small-batch formulas made with intention and shipped with care.",
  heroBadgeOne: "",
  heroBadgeTwo: "",
  heroBadgeThree: "",
  backgroundColor: DEFAULT_BACKGROUND,
  surfaceColor: DEFAULT_SURFACE,
  textColor: DEFAULT_TEXT,
  headerBackgroundColor: DEFAULT_SURFACE,
  headerForegroundColor: DEFAULT_TEXT,
  headerShowLogo: true,
  headerShowTitle: true,
  headerLogoSize: "medium",
  headerTitleSize: "medium",
  primaryForegroundColor: null,
  accentForegroundColor: null,
  headerNavItems: ["home", "products", "about", "policies"],
  footerNavItems: ["products", "cart", "about", "policies"],
  showFooterBackToTop: true,
  showFooterOwnerLogin: true,
  homeShowHero: true,
  homeShowContentBlocks: true,
  homeShowFeaturedProducts: true,
  homeFeaturedProductsLimit: 6,
  productsFilterLayout: "sidebar",
  productsFiltersDefaultOpen: false,
  productsShowSearch: true,
  productsShowSort: true,
  productsShowAvailability: true,
  productsShowOptionFilters: true,
  productCardShowDescription: true,
  productCardDescriptionLines: 2,
  productCardShowFeaturedBadge: true,
  productCardShowAvailability: true,
  productCardShowQuickAdd: true,
  productCardImageHoverZoom: true,
  productCardShowCarouselArrows: true,
  productCardShowCarouselDots: true,
  productCardImageFit: "cover",
  primaryCtaStyle: "primary",
  reviewsEnabled: true,
  reviewsShowOnHome: true,
  reviewsShowOnProductDetail: true,
  reviewsFormEnabled: true,
  reviewsDefaultSort: "newest",
  reviewsItemsPerPage: 10,
  reviewsShowVerifiedBadge: true,
  reviewsShowMediaGallery: true,
  reviewsShowSummary: true
};

function normalizeHex(input: string | null | undefined): string | null {
  if (!input) {
    return null;
  }

  const value = input.trim();
  return /^#([0-9a-fA-F]{6})$/.test(value) ? value.toUpperCase() : null;
}

function hexToRgbTriplet(hex: string): string {
  const normalized = normalizeHex(hex) ?? "#000000";
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return `${red}, ${green}, ${blue}`;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex) ?? "#000000";
  return {
    red: Number.parseInt(normalized.slice(1, 3), 16),
    green: Number.parseInt(normalized.slice(3, 5), 16),
    blue: Number.parseInt(normalized.slice(5, 7), 16)
  };
}

function rgbToHex(red: number, green: number, blue: number) {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return `#${[clamp(red), clamp(green), clamp(blue)].map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function mixHex(left: string, right: string, leftWeight = 0.5) {
  const safeLeftWeight = Math.max(0, Math.min(1, leftWeight));
  const safeRightWeight = 1 - safeLeftWeight;
  const leftRgb = hexToRgb(left);
  const rightRgb = hexToRgb(right);

  return rgbToHex(
    leftRgb.red * safeLeftWeight + rightRgb.red * safeRightWeight,
    leftRgb.green * safeLeftWeight + rightRgb.green * safeRightWeight,
    leftRgb.blue * safeLeftWeight + rightRgb.blue * safeRightWeight
  );
}

function hexToHslChannels(hex: string): string {
  const { red, green, blue } = hexToRgb(hex);
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === r) {
      hue = ((g - b) / delta) % 6;
    } else if (max === g) {
      hue = (b - r) / delta + 2;
    } else {
      hue = (r - g) / delta + 4;
    }
  }

  hue = Math.round((hue * 60 + 360) % 360);
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  return `${hue} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

function resolveContrastingForeground(hex: string): string {
  const normalized = normalizeHex(hex) ?? "#000000";
  const luminance = getRelativeLuminance(normalized);
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  const contrastWithBlack = (luminance + 0.05) / 0.05;

  return contrastWithBlack >= contrastWithWhite ? "#111111" : "#FFFFFF";
}

function getRelativeLuminance(hex: string) {
  const normalized = normalizeHex(hex) ?? "#000000";
  const toLinear = (channel: string) => {
    const normalizedChannel = Number.parseInt(channel, 16) / 255;
    return normalizedChannel <= 0.04045 ? normalizedChannel / 12.92 : ((normalizedChannel + 0.055) / 1.055) ** 2.4;
  };

  return (
    0.2126 * toLinear(normalized.slice(1, 3)) +
    0.7152 * toLinear(normalized.slice(3, 5)) +
    0.0722 * toLinear(normalized.slice(5, 7))
  );
}

function getContrastRatio(foregroundHex: string, backgroundHex: string) {
  const foregroundLuminance = getRelativeLuminance(foregroundHex);
  const backgroundLuminance = getRelativeLuminance(backgroundHex);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function resolveAccessibleForeground(backgroundHex: string, preferredForegroundHex: string | null | undefined) {
  const preferred = normalizeHex(preferredForegroundHex ?? null);
  if (preferred && getContrastRatio(preferred, backgroundHex) >= 4.5) {
    return preferred;
  }

  return resolveContrastingForeground(backgroundHex);
}

function pickStringOption<T extends readonly string[]>(value: unknown, options: T, fallback: T[number]): T[number] {
  return typeof value === "string" && (options as readonly string[]).includes(value) ? (value as T[number]) : fallback;
}

function pickNumberOption<T extends readonly number[]>(value: unknown, options: T, fallback: T[number]): T[number] {
  return typeof value === "number" && (options as readonly number[]).includes(value) ? (value as T[number]) : fallback;
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function pickInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, value));
}

function pickArrayOption<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: readonly T[number][],
  minLength = 0
): T[number][] {
  if (!Array.isArray(value)) {
    return [...fallback] as T[number][];
  }

  const deduped: T[number][] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    if (!(allowed as readonly string[]).includes(item)) {
      continue;
    }
    if (!deduped.includes(item as T[number])) {
      deduped.push(item as T[number]);
    }
  }

  if (deduped.length < minLength) {
    return [...fallback] as T[number][];
  }

  return deduped;
}

function pickString(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed.length) {
    return fallback;
  }

  return trimmed.slice(0, maxLength);
}

export function resolveStorefrontThemeConfig(raw: unknown): StorefrontThemeConfig {
  const candidate = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const legacyFontPreset = pickStringOption(candidate.fontPreset, FONT_PRESET_OPTIONS, "classic");
  const resolvedHeroBrandDisplay = pickStringOption(
    candidate.heroBrandDisplay,
    HERO_BRAND_DISPLAY_OPTIONS,
    DEFAULT_STOREFRONT_THEME_CONFIG.heroBrandDisplay
  );
  const fallbackHeroShowLogo = resolvedHeroBrandDisplay === "logo" || resolvedHeroBrandDisplay === "logo_and_title";
  const fallbackHeroShowTitle = resolvedHeroBrandDisplay === "title" || resolvedHeroBrandDisplay === "logo_and_title";

  const fallbackFontFamily =
    legacyFontPreset === "modern"
      ? "trebuchet"
      : legacyFontPreset === "clean"
        ? "helvetica-neue"
        : DEFAULT_STOREFRONT_THEME_CONFIG.fontFamily;

  return {
    pageWidth: pickStringOption(candidate.pageWidth, PAGE_WIDTH_OPTIONS, DEFAULT_STOREFRONT_THEME_CONFIG.pageWidth),
    heroLayout: pickStringOption(candidate.heroLayout, HERO_LAYOUT_OPTIONS, DEFAULT_STOREFRONT_THEME_CONFIG.heroLayout),
    heroBrandDisplay: resolvedHeroBrandDisplay,
    heroShowLogo: pickBoolean(candidate.heroShowLogo, fallbackHeroShowLogo),
    heroShowTitle: pickBoolean(candidate.heroShowTitle, fallbackHeroShowTitle),
    heroImageSize: pickStringOption(candidate.heroImageSize, HERO_IMAGE_SIZE_OPTIONS, DEFAULT_STOREFRONT_THEME_CONFIG.heroImageSize),
    productGridColumns: pickNumberOption(
      candidate.productGridColumns,
      PRODUCT_GRID_OPTIONS,
      DEFAULT_STOREFRONT_THEME_CONFIG.productGridColumns
    ),
    radiusScale: pickStringOption(candidate.radiusScale, RADIUS_OPTIONS, DEFAULT_STOREFRONT_THEME_CONFIG.radiusScale),
    cardStyle: pickStringOption(candidate.cardStyle, CARD_STYLE_OPTIONS, DEFAULT_STOREFRONT_THEME_CONFIG.cardStyle),
    spacingScale: pickStringOption(candidate.spacingScale, SPACING_OPTIONS, DEFAULT_STOREFRONT_THEME_CONFIG.spacingScale),
    fontFamily: pickStringOption(candidate.fontFamily, STOREFRONT_FONT_FAMILY_OPTIONS, fallbackFontFamily),
    showContentBlocks: pickBoolean(candidate.showContentBlocks, DEFAULT_STOREFRONT_THEME_CONFIG.showContentBlocks),
    showPolicyStrip: pickBoolean(candidate.showPolicyStrip, DEFAULT_STOREFRONT_THEME_CONFIG.showPolicyStrip),
    heroEyebrow: pickString(candidate.heroEyebrow, DEFAULT_STOREFRONT_THEME_CONFIG.heroEyebrow, 80),
    heroHeadline: pickString(candidate.heroHeadline, DEFAULT_STOREFRONT_THEME_CONFIG.heroHeadline, 120),
    heroSubcopy: pickString(candidate.heroSubcopy, DEFAULT_STOREFRONT_THEME_CONFIG.heroSubcopy, 240),
    heroBadgeOne: pickString(candidate.heroBadgeOne, DEFAULT_STOREFRONT_THEME_CONFIG.heroBadgeOne, 40),
    heroBadgeTwo: pickString(candidate.heroBadgeTwo, DEFAULT_STOREFRONT_THEME_CONFIG.heroBadgeTwo, 40),
    heroBadgeThree: pickString(candidate.heroBadgeThree, DEFAULT_STOREFRONT_THEME_CONFIG.heroBadgeThree, 40),
    backgroundColor: normalizeHex(typeof candidate.backgroundColor === "string" ? candidate.backgroundColor : null) ?? DEFAULT_BACKGROUND,
    surfaceColor: normalizeHex(typeof candidate.surfaceColor === "string" ? candidate.surfaceColor : null) ?? DEFAULT_SURFACE,
    textColor: normalizeHex(typeof candidate.textColor === "string" ? candidate.textColor : null) ?? DEFAULT_TEXT,
    headerBackgroundColor:
      normalizeHex(typeof candidate.headerBackgroundColor === "string" ? candidate.headerBackgroundColor : null) ??
      normalizeHex(typeof candidate.surfaceColor === "string" ? candidate.surfaceColor : null) ??
      DEFAULT_SURFACE,
    headerForegroundColor:
      normalizeHex(typeof candidate.headerForegroundColor === "string" ? candidate.headerForegroundColor : null) ??
      resolveContrastingForeground(
        normalizeHex(typeof candidate.headerBackgroundColor === "string" ? candidate.headerBackgroundColor : null) ??
          normalizeHex(typeof candidate.surfaceColor === "string" ? candidate.surfaceColor : null) ??
          DEFAULT_SURFACE
      ),
    headerShowLogo: pickBoolean(candidate.headerShowLogo, DEFAULT_STOREFRONT_THEME_CONFIG.headerShowLogo),
    headerShowTitle: pickBoolean(candidate.headerShowTitle, DEFAULT_STOREFRONT_THEME_CONFIG.headerShowTitle),
    headerLogoSize: pickStringOption(candidate.headerLogoSize, HEADER_LOGO_SIZE_OPTIONS, DEFAULT_STOREFRONT_THEME_CONFIG.headerLogoSize),
    headerTitleSize: pickStringOption(candidate.headerTitleSize, HEADER_TITLE_SIZE_OPTIONS, DEFAULT_STOREFRONT_THEME_CONFIG.headerTitleSize),
    primaryForegroundColor:
      normalizeHex(typeof candidate.primaryForegroundColor === "string" ? candidate.primaryForegroundColor : null) ?? null,
    accentForegroundColor:
      normalizeHex(typeof candidate.accentForegroundColor === "string" ? candidate.accentForegroundColor : null) ?? null,
    headerNavItems: pickArrayOption(
      candidate.headerNavItems,
      NAV_ITEM_IDS,
      DEFAULT_STOREFRONT_THEME_CONFIG.headerNavItems,
      1
    ),
    footerNavItems: pickArrayOption(
      candidate.footerNavItems,
      FOOTER_ITEM_IDS,
      DEFAULT_STOREFRONT_THEME_CONFIG.footerNavItems,
      1
    ),
    showFooterBackToTop: pickBoolean(candidate.showFooterBackToTop, DEFAULT_STOREFRONT_THEME_CONFIG.showFooterBackToTop),
    showFooterOwnerLogin: pickBoolean(candidate.showFooterOwnerLogin, DEFAULT_STOREFRONT_THEME_CONFIG.showFooterOwnerLogin),
    homeShowHero: pickBoolean(candidate.homeShowHero, DEFAULT_STOREFRONT_THEME_CONFIG.homeShowHero),
    homeShowContentBlocks: pickBoolean(candidate.homeShowContentBlocks, DEFAULT_STOREFRONT_THEME_CONFIG.homeShowContentBlocks),
    homeShowFeaturedProducts: pickBoolean(candidate.homeShowFeaturedProducts, DEFAULT_STOREFRONT_THEME_CONFIG.homeShowFeaturedProducts),
    homeFeaturedProductsLimit: pickInteger(
      candidate.homeFeaturedProductsLimit,
      DEFAULT_STOREFRONT_THEME_CONFIG.homeFeaturedProductsLimit,
      1,
      24
    ),
    productsFilterLayout: pickStringOption(
      candidate.productsFilterLayout,
      FILTER_LAYOUT_OPTIONS,
      DEFAULT_STOREFRONT_THEME_CONFIG.productsFilterLayout
    ),
    productsFiltersDefaultOpen: pickBoolean(
      candidate.productsFiltersDefaultOpen,
      DEFAULT_STOREFRONT_THEME_CONFIG.productsFiltersDefaultOpen
    ),
    productsShowSearch: pickBoolean(candidate.productsShowSearch, DEFAULT_STOREFRONT_THEME_CONFIG.productsShowSearch),
    productsShowSort: pickBoolean(candidate.productsShowSort, DEFAULT_STOREFRONT_THEME_CONFIG.productsShowSort),
    productsShowAvailability: pickBoolean(
      candidate.productsShowAvailability,
      DEFAULT_STOREFRONT_THEME_CONFIG.productsShowAvailability
    ),
    productsShowOptionFilters: pickBoolean(
      candidate.productsShowOptionFilters,
      DEFAULT_STOREFRONT_THEME_CONFIG.productsShowOptionFilters
    ),
    productCardShowDescription: pickBoolean(
      candidate.productCardShowDescription,
      DEFAULT_STOREFRONT_THEME_CONFIG.productCardShowDescription
    ),
    productCardDescriptionLines: pickInteger(
      candidate.productCardDescriptionLines,
      DEFAULT_STOREFRONT_THEME_CONFIG.productCardDescriptionLines,
      1,
      4
    ),
    productCardShowFeaturedBadge: pickBoolean(
      candidate.productCardShowFeaturedBadge,
      DEFAULT_STOREFRONT_THEME_CONFIG.productCardShowFeaturedBadge
    ),
    productCardShowAvailability: pickBoolean(
      candidate.productCardShowAvailability,
      DEFAULT_STOREFRONT_THEME_CONFIG.productCardShowAvailability
    ),
    productCardShowQuickAdd: pickBoolean(
      candidate.productCardShowQuickAdd,
      DEFAULT_STOREFRONT_THEME_CONFIG.productCardShowQuickAdd
    ),
    productCardImageHoverZoom: pickBoolean(
      candidate.productCardImageHoverZoom,
      DEFAULT_STOREFRONT_THEME_CONFIG.productCardImageHoverZoom
    ),
    productCardShowCarouselArrows: pickBoolean(
      candidate.productCardShowCarouselArrows,
      DEFAULT_STOREFRONT_THEME_CONFIG.productCardShowCarouselArrows
    ),
    productCardShowCarouselDots: pickBoolean(
      candidate.productCardShowCarouselDots,
      DEFAULT_STOREFRONT_THEME_CONFIG.productCardShowCarouselDots
    ),
    productCardImageFit: pickStringOption(
      candidate.productCardImageFit,
      IMAGE_FIT_OPTIONS,
      DEFAULT_STOREFRONT_THEME_CONFIG.productCardImageFit
    ),
    primaryCtaStyle: pickStringOption(
      candidate.primaryCtaStyle,
      CTA_STYLE_OPTIONS,
      DEFAULT_STOREFRONT_THEME_CONFIG.primaryCtaStyle
    ),
    reviewsEnabled: pickBoolean(candidate.reviewsEnabled, DEFAULT_STOREFRONT_THEME_CONFIG.reviewsEnabled),
    reviewsShowOnHome: pickBoolean(candidate.reviewsShowOnHome, DEFAULT_STOREFRONT_THEME_CONFIG.reviewsShowOnHome),
    reviewsShowOnProductDetail: pickBoolean(
      candidate.reviewsShowOnProductDetail,
      DEFAULT_STOREFRONT_THEME_CONFIG.reviewsShowOnProductDetail
    ),
    reviewsFormEnabled: pickBoolean(candidate.reviewsFormEnabled, DEFAULT_STOREFRONT_THEME_CONFIG.reviewsFormEnabled),
    reviewsDefaultSort: pickStringOption(
      candidate.reviewsDefaultSort,
      REVIEW_SORT_OPTIONS,
      DEFAULT_STOREFRONT_THEME_CONFIG.reviewsDefaultSort
    ),
    reviewsItemsPerPage: pickInteger(candidate.reviewsItemsPerPage, DEFAULT_STOREFRONT_THEME_CONFIG.reviewsItemsPerPage, 1, 50),
    reviewsShowVerifiedBadge: pickBoolean(
      candidate.reviewsShowVerifiedBadge,
      DEFAULT_STOREFRONT_THEME_CONFIG.reviewsShowVerifiedBadge
    ),
    reviewsShowMediaGallery: pickBoolean(
      candidate.reviewsShowMediaGallery,
      DEFAULT_STOREFRONT_THEME_CONFIG.reviewsShowMediaGallery
    ),
    reviewsShowSummary: pickBoolean(candidate.reviewsShowSummary, DEFAULT_STOREFRONT_THEME_CONFIG.reviewsShowSummary)
  };
}

export function buildStorefrontThemeStyle(input: StorefrontThemeInput): CSSProperties {
  const primary = normalizeHex(input.primaryColor) ?? DEFAULT_PRIMARY;
  const accent = normalizeHex(input.accentColor) ?? DEFAULT_ACCENT;
  const config = resolveStorefrontThemeConfig(input.themeConfig);
  const primaryRgb = hexToRgbTriplet(primary);
  const accentRgb = hexToRgbTriplet(accent);
  const primaryForeground = resolveAccessibleForeground(primary, config.primaryForegroundColor);
  const accentForeground = resolveAccessibleForeground(accent, config.accentForegroundColor);
  const headerForeground = resolveAccessibleForeground(config.headerBackgroundColor, config.headerForegroundColor);
  const border = mixHex(config.textColor, config.surfaceColor, 0.2);
  const muted = mixHex(primary, config.surfaceColor, 0.12);
  const mutedForeground = mixHex(config.textColor, config.surfaceColor, 0.62);
  const resolvedFontOption =
    STOREFRONT_FONT_OPTIONS.find((option) => option.id === config.fontFamily) ??
    STOREFRONT_FONT_OPTIONS.find((option) => option.id === DEFAULT_STOREFRONT_THEME_CONFIG.fontFamily) ??
    STOREFRONT_FONT_OPTIONS[0]!;

  return {
    ["--storefront-primary" as string]: primary,
    ["--storefront-accent" as string]: accent,
    ["--storefront-primary-rgb" as string]: primaryRgb,
    ["--storefront-accent-rgb" as string]: accentRgb,
    ["--storefront-primary-foreground" as string]: primaryForeground,
    ["--storefront-accent-foreground" as string]: accentForeground,
    ["--storefront-bg" as string]: config.backgroundColor,
    ["--storefront-surface" as string]: config.surfaceColor,
    ["--storefront-text" as string]: config.textColor,
    ["--storefront-header-bg" as string]: config.headerBackgroundColor,
    ["--storefront-header-fg" as string]: headerForeground,
    ["--storefront-font-heading" as string]: resolvedFontOption.headingStack,
    ["--storefront-font-body" as string]: resolvedFontOption.bodyStack,
    ["--background" as string]: hexToHslChannels(config.backgroundColor),
    ["--foreground" as string]: hexToHslChannels(config.textColor),
    ["--card" as string]: hexToHslChannels(config.surfaceColor),
    ["--popover" as string]: hexToHslChannels(config.surfaceColor),
    ["--popover-foreground" as string]: hexToHslChannels(config.textColor),
    ["--border" as string]: hexToHslChannels(border),
    ["--input" as string]: hexToHslChannels(border),
    ["--ring" as string]: hexToHslChannels(primary),
    ["--primary" as string]: hexToHslChannels(primary),
    ["--primary-foreground" as string]: hexToHslChannels(primaryForeground),
    ["--muted" as string]: hexToHslChannels(muted),
    ["--muted-foreground" as string]: hexToHslChannels(mutedForeground),
    ["--accent" as string]: hexToHslChannels(accent),
    ["--accent-foreground" as string]: hexToHslChannels(accentForeground)
  };
}
