"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Filter, FilterX, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { buildStorefrontThemeStyle, resolveStorefrontThemeConfig, type StorefrontThemeConfig } from "@/lib/theme/storefront-theme";
import { formatVariantLabel } from "@/lib/products/variants";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { StorefrontImageCarousel } from "@/components/storefront/storefront-image-carousel";
import { StorefrontCartButton } from "@/components/storefront/storefront-cart-button";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";
import { StorefrontReviewsSection } from "@/components/storefront/storefront-reviews-section";
import { MAIN_CONTENT_ID } from "@/lib/accessibility";
import { StorefrontStudioEditableLink } from "@/components/storefront/storefront-studio-editable-link";
import { StorefrontStudioEditableInputPlaceholder } from "@/components/storefront/storefront-studio-editable-input-placeholder";
import { StorefrontStudioEditableStoreName } from "@/components/storefront/storefront-studio-editable-store-name";
import { StorefrontStudioEditableText } from "@/components/storefront/storefront-studio-editable-text";
import { StorefrontStudioEditableHeroImage } from "@/components/storefront/storefront-studio-editable-hero-image";
import { StorefrontStudioHomeContentBlockActions } from "@/components/storefront/storefront-studio-home-content-block-actions";
import { StorefrontStudioSelectableRegion } from "@/components/storefront/storefront-studio-selectable-region";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { useOptionalStorefrontRuntime } from "@/components/storefront/storefront-runtime-provider";
import { useOptionalStorefrontAnalytics } from "@/components/storefront/storefront-analytics-provider";
import { useStorefrontPageView, useStorefrontSearchAnalytics } from "@/components/storefront/use-storefront-analytics-events";
import { buildStorefrontAddToCartValue } from "@/lib/analytics/storefront-instrumentation";
import { readStorefrontCart, syncStorefrontCart, writeStorefrontCart, type StorefrontCartEntry } from "@/lib/storefront/cart";
import { formatCopyTemplate, resolveStorefrontCopy } from "@/lib/storefront/copy";
import { getStorefrontButtonRadiusClass, getStorefrontCardStyleClass, getStorefrontRadiusClass } from "@/lib/storefront/appearance";
import { getStorefrontPageShellClass, getStorefrontPageWidthClass } from "@/lib/storefront/layout";
import { STOREFRONT_TEXT_LINK_EFFECT_CLASS } from "@/lib/storefront/link-effects";
import { resolveFooterNavLinks, resolveHeaderNavLinks } from "@/lib/storefront/navigation";
import { resolveStorefrontPresentation } from "@/lib/storefront/presentation";
import {
  buildStorefrontAboutPath,
  buildStorefrontProductPath,
  buildStorefrontProductsPath
} from "@/lib/storefront/paths";
import { setEditorValueAtPath } from "@/lib/store-editor/object-path";
import { setStorefrontStudioHomeField, updateStorefrontStudioHomeContentBlock } from "@/lib/storefront/studio-home-edit";

type StorefrontVariant = {
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

type StorefrontProduct = {
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

type StorefrontPageProps = {
  store: {
    id: string;
    name: string;
    slug: string;
  };
  viewer?: {
    isAuthenticated: boolean;
    canManageStore: boolean;
  };
  branding: {
    logo_path: string | null;
    primary_color: string | null;
    accent_color: string | null;
    theme_json?: Record<string, unknown> | null;
  } | null;
  settings: {
    support_email: string | null;
    fulfillment_message: string | null;
    shipping_policy: string | null;
    return_policy: string | null;
    announcement: string | null;
    seo_title?: string | null;
    seo_description?: string | null;
    seo_noindex?: boolean;
    footer_tagline: string | null;
    footer_note: string | null;
    instagram_url: string | null;
    facebook_url: string | null;
    tiktok_url: string | null;
    email_capture_enabled?: boolean | null;
    email_capture_heading?: string | null;
    email_capture_description?: string | null;
    email_capture_success_message?: string | null;
    storefront_copy_json?: Record<string, unknown> | null;
  } | null;
  contentBlocks: Array<{
    id: string;
    sort_order: number;
    eyebrow: string | null;
    title: string;
    body: string;
    cta_label: string | null;
    cta_url: string | null;
    is_active: boolean;
  }>;
  products: StorefrontProduct[];
  view?: "home" | "products";
  reviewsEnabled?: boolean;
  emailStudio?: boolean;
};

type AvailabilityFilterMode = "all" | "in-stock" | "made-to-order";
type ProductSortMode = "featured" | "newest" | "price-asc" | "price-desc" | "title-asc";

const containerGapClasses = {
  compact: "gap-4",
  comfortable: "gap-6",
  airy: "gap-8"
} as const;

const productGridClasses = {
  2: "grid gap-4 sm:gap-5 sm:grid-cols-2",
  3: "grid gap-4 sm:gap-5 sm:grid-cols-2 xl:grid-cols-3",
  4: "grid gap-4 sm:gap-5 sm:grid-cols-2 xl:grid-cols-4"
} as const;

function getSortedActiveVariants(product: StorefrontProduct) {
  return [...(product.product_variants ?? [])]
    .filter((variant) => variant.status === "active")
    .sort((left, right) => {
      if (left.sort_order === right.sort_order) {
        return left.created_at.localeCompare(right.created_at);
      }
      return left.sort_order - right.sort_order;
    });
}

function getDefaultVariant(product: StorefrontProduct) {
  const variants = getSortedActiveVariants(product);
  return variants.find((variant) => variant.is_default) ?? variants[0] ?? null;
}

function getVariantOptionNames(product: StorefrontProduct, variants: StorefrontVariant[]) {
  const configuredAxes = [...(product.product_option_axes ?? [])]
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((axis) => axis.name);

  if (configuredAxes.length > 0) {
    return configuredAxes;
  }

  const names: string[] = [];
  const seen = new Set<string>();

  for (const variant of variants) {
    for (const name of Object.keys(variant.option_values ?? {})) {
      if (!seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
    }
  }

  return names;
}

function getVariantImages(variant: StorefrontVariant | null, product: StorefrontProduct) {
  const ordered = [...(variant?.image_urls ?? []), ...(variant?.group_image_urls ?? []), ...(product.image_urls ?? [])].filter(
    (image): image is string => Boolean(image)
  );

  const unique: string[] = [];
  const seen = new Set<string>();

  for (const image of ordered) {
    if (seen.has(image)) {
      continue;
    }
    seen.add(image);
    unique.push(image);
  }

  return unique;
}

function getPriceRange(variants: StorefrontVariant[]) {
  if (variants.length === 0) {
    return { minPriceCents: 0, maxPriceCents: 0 };
  }

  const minPriceCents = variants.reduce((min, variant) => Math.min(min, variant.price_cents), variants[0]?.price_cents ?? 0);
  const maxPriceCents = variants.reduce((max, variant) => Math.max(max, variant.price_cents), variants[0]?.price_cents ?? 0);
  return { minPriceCents, maxPriceCents };
}

function toPlainText(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function truncateWithEllipsis(content: string, maxLength: number) {
  if (content.length <= maxLength) {
    return content;
  }
  return `${content.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function buildProductHref(product: StorefrontProduct, storeSlug: string) {
  const key = product.slug || product.id;
  return buildStorefrontProductPath(storeSlug, key);
}

function getAvailabilityLabel(
  variant: StorefrontVariant | null,
  fulfillmentMessage: string | null,
  copy: ReturnType<typeof resolveStorefrontCopy>
) {
  if (!variant) {
    return copy.availability.unavailable;
  }

  const isMadeToOrderActive = variant.is_made_to_order && variant.inventory_qty < 1;
  if (isMadeToOrderActive) {
    return fulfillmentMessage
      ? formatCopyTemplate(copy.availability.madeToOrderWithFulfillmentTemplate, { message: fulfillmentMessage })
      : copy.availability.madeToOrder;
  }
  if (variant.inventory_qty <= 0) {
    return copy.availability.outOfStock;
  }
  return `${variant.inventory_qty} ${copy.availability.inStockSuffix}`;
}

function getPrimaryCtaClass(themeConfig: StorefrontThemeConfig, buttonRadiusClass: string) {
  if (themeConfig.primaryCtaStyle === "accent") {
    return cn("inline-flex h-10 items-center justify-center bg-[var(--storefront-accent)] px-4 text-sm font-medium text-[color:var(--storefront-accent-foreground)] hover:opacity-90", buttonRadiusClass);
  }

  if (themeConfig.primaryCtaStyle === "outline") {
    return cn(
      "inline-flex h-10 items-center justify-center border border-border px-4 text-sm font-medium hover:bg-[color:var(--storefront-text)] hover:text-[color:var(--storefront-bg)]",
      buttonRadiusClass
    );
  }

  return cn(
    "inline-flex h-10 items-center justify-center bg-[var(--storefront-primary)] px-4 text-sm font-medium text-[color:var(--storefront-primary-foreground)] hover:opacity-90",
    buttonRadiusClass
  );
}

function ensureStorefrontSettingsDraft(
  current: NonNullable<ReturnType<typeof resolveStorefrontPresentation>>["settings"] | null | undefined
) {
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

export function StorefrontPage(props: StorefrontPageProps) {
  const runtime = useOptionalStorefrontRuntime();
  const studioDocument = useOptionalStorefrontStudioDocument();
  const { store, viewer, branding, settings, products, contentBlocks, view = "home", reviewsEnabled = true, emailStudio = false } = props;
  const resolvedStore = runtime?.store ?? store;
  const resolvedViewer = runtime?.viewer ?? viewer;
  const resolvedBranding = runtime?.branding ?? branding;
  const resolvedProducts = runtime?.products ?? products;
  const resolvedPresentation = runtime ? resolveStorefrontPresentation(runtime) : null;
  const resolvedSettings = resolvedPresentation?.settings ?? settings;
  const resolvedContentBlocks = resolvedPresentation?.contentBlocks ?? contentBlocks;
  const analytics = useOptionalStorefrontAnalytics();
  const themeConfig = resolvedPresentation?.themeConfig ?? resolveStorefrontThemeConfig(resolvedBranding?.theme_json ?? {});
  const copy = resolvedPresentation?.copy ?? resolveStorefrontCopy(resolvedSettings?.storefront_copy_json ?? {});
  const headerNavLinks = resolveHeaderNavLinks(themeConfig, copy, resolvedStore.slug);
  const footerNavLinks = resolveFooterNavLinks(themeConfig, copy, resolvedStore.slug);
  const studioEnabled = runtime?.mode === "studio";
  const homeSectionDraft = studioEnabled ? studioDocument?.getSectionDraft("home") ?? null : null;
  const productsSectionDraft = studioEnabled ? studioDocument?.getSectionDraft("productsPage") ?? null : null;

  const [cart, setCart] = useState<StorefrontCartEntry[]>([]);
  const hasHydratedCartRef = useRef(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilterMode>("all");
  const [selectedFilterValuesByAxis, setSelectedFilterValuesByAxis] = useState<Record<string, string[]>>({});
  const [sortMode, setSortMode] = useState<ProductSortMode>("featured");
  const [showFilters, setShowFilters] = useState(themeConfig.productsFiltersDefaultOpen);
  const [showAllHomeContentBlocks, setShowAllHomeContentBlocks] = useState(false);
  const homeFeaturedProductsLimit = themeConfig.homeFeaturedProductsLimit;
  const productsShowAvailability = themeConfig.productsShowAvailability;
  const productsShowOptionFilters = themeConfig.productsShowOptionFilters;

  const heroImageUrl =
    typeof homeSectionDraft?.hero === "object" &&
    homeSectionDraft.hero &&
    !Array.isArray(homeSectionDraft.hero) &&
    typeof (homeSectionDraft.hero as Record<string, unknown>).imageUrl === "string"
      ? ((homeSectionDraft.hero as Record<string, unknown>).imageUrl as string)
      : runtime && typeof runtime.experienceContent.home.hero === "object" && runtime.experienceContent.home.hero && !Array.isArray(runtime.experienceContent.home.hero)
        ? (typeof (runtime.experienceContent.home.hero as Record<string, unknown>).imageUrl === "string"
          ? ((runtime.experienceContent.home.hero as Record<string, unknown>).imageUrl as string)
          : "")
        : "";
  const resolvedHeroImageUrl = heroImageUrl.trim();
  const showHeroImage = resolvedHeroImageUrl.length > 0;
  const showHeroTitle = themeConfig.heroShowTitle;
  const storefrontThemeStyle = buildStorefrontThemeStyle({
    primaryColor: resolvedBranding?.primary_color,
    accentColor: resolvedBranding?.accent_color,
    themeConfig
  });

  const radiusClass = getStorefrontRadiusClass(themeConfig.radiusScale);
  const cardClass = getStorefrontCardStyleClass(themeConfig.cardStyle);
  const isIntegrated = themeConfig.cardStyle === "integrated";
  const buttonRadiusClass = getStorefrontButtonRadiusClass(themeConfig.radiusScale);
  const isProductsView = view === "products";
  const isCenteredHeroLayout = themeConfig.heroLayout === "centered";
  const shopProductsHref = copy.home.shopProductsUrl.trim() || buildStorefrontProductsPath(resolvedStore.slug);
  const aboutBrandHref = copy.home.aboutBrandUrl.trim() || buildStorefrontAboutPath(resolvedStore.slug);

  const hasFeaturedProducts = resolvedProducts.some((product) => product.is_featured);
  const sortedContentBlocks = [...resolvedContentBlocks].sort((a, b) => a.sort_order - b.sort_order);
  const activeContentBlocks = sortedContentBlocks.filter((block) => block.is_active);
  const visibleContentBlocks = studioEnabled && showAllHomeContentBlocks ? sortedContentBlocks : activeContentBlocks;
  const shouldShowContentBlocksHeading = (activeContentBlocks[0]?.title.trim().toLowerCase() ?? "") !== "our approach";
  const footerStudio = studioEnabled
    ? {
        newsletterFocus: emailStudio,
        onTaglineChange: (value: string) =>
          studioDocument?.setSettingsDraft((current) => ({
            ...ensureStorefrontSettingsDraft(current),
            footer_tagline: value
          })),
        onNoteChange: (value: string) =>
          studioDocument?.setSettingsDraft((current) => ({
            ...ensureStorefrontSettingsDraft(current),
            footer_note: value
          })),
        onHeadingChange: (value: string) =>
          studioDocument?.setSettingsDraft((current) => ({
            ...ensureStorefrontSettingsDraft(current),
            email_capture_heading: value
          })),
        onDescriptionChange: (value: string) =>
          studioDocument?.setSettingsDraft((current) => ({
            ...ensureStorefrontSettingsDraft(current),
            email_capture_description: value
          }))
      }
    : undefined;

  function updateProductsField(path: string, value: unknown) {
    studioDocument?.setSectionDraft("productsPage", (current) => setEditorValueAtPath(current, path, value));
  }

  const reviewsStudio = studioEnabled
    ? {
        onSectionTitleChange: (value: string) => updateProductsField("copy.reviews.sectionTitle", value),
        onSummaryTemplateChange: (value: string) => updateProductsField("copy.reviews.summaryTemplate", value),
        onEmptyStateChange: (value: string) => updateProductsField("copy.reviews.emptyState", value),
        onLoadMoreChange: (value: string) => updateProductsField("copy.reviews.loadMore", value),
        onFormTitleChange: (value: string) => updateProductsField("copy.reviews.formTitle", value)
      }
    : undefined;

  useStorefrontPageView(isProductsView ? "products" : "home", {
    view: isProductsView ? "products" : "home",
    featuredProductCount: isProductsView ? null : resolvedProducts.filter((product) => product.is_featured).length
  });

  const availableAxisNames = useMemo(() => {
    const names = new Set<string>();
    for (const product of resolvedProducts) {
      for (const variant of getSortedActiveVariants(product)) {
        for (const name of Object.keys(variant.option_values ?? {})) {
          names.add(name);
        }
      }
    }
    return [...names].sort((left, right) => left.localeCompare(right));
  }, [resolvedProducts]);

  const availableAxisValuesByName = useMemo(() => {
    const valuesByAxis: Record<string, string[]> = {};
    for (const axis of availableAxisNames) {
      const values = new Set<string>();
      for (const product of resolvedProducts) {
        for (const variant of getSortedActiveVariants(product)) {
          const value = variant.option_values?.[axis];
          if (value) {
            values.add(value);
          }
        }
      }
      valuesByAxis[axis] = [...values].sort((left, right) => left.localeCompare(right));
    }
    return valuesByAxis;
  }, [availableAxisNames, resolvedProducts]);

  const effectiveSelectedFilterValuesByAxis = useMemo(() => {
    const normalized: Record<string, string[]> = {};
    for (const axis of availableAxisNames) {
      const availableValues = availableAxisValuesByName[axis] ?? [];
      const selectedValues = selectedFilterValuesByAxis[axis] ?? [];
      const sanitized = selectedValues.filter((value) => availableValues.includes(value));
      if (sanitized.length > 0) {
        normalized[axis] = sanitized;
      }
    }
    return normalized;
  }, [availableAxisNames, availableAxisValuesByName, selectedFilterValuesByAxis]);

  const filteredProducts = (() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    let scoped = [...resolvedProducts];

    if (!isProductsView) {
      scoped = scoped.filter((product) => product.is_featured);
      scoped = scoped.slice(0, homeFeaturedProductsLimit);
    }

    if (isProductsView && normalizedSearch.length > 0) {
      scoped = scoped.filter((product) => {
        const descriptionText = toPlainText(product.description).toLowerCase();
        if (product.title.toLowerCase().includes(normalizedSearch) || descriptionText.includes(normalizedSearch)) {
          return true;
        }
        return getSortedActiveVariants(product).some((variant) => formatVariantLabel(variant, "Default").toLowerCase().includes(normalizedSearch));
      });
    }

    if (isProductsView && productsShowAvailability && availabilityFilter !== "all") {
      scoped = scoped.filter((product) => {
        const variants = getSortedActiveVariants(product);
        if (availabilityFilter === "made-to-order") {
          return variants.some((variant) => variant.is_made_to_order);
        }
        return variants.some((variant) => !variant.is_made_to_order && variant.inventory_qty > 0);
      });
    }

    if (isProductsView && productsShowOptionFilters) {
      const selectedAxes = Object.keys(effectiveSelectedFilterValuesByAxis);
      if (selectedAxes.length > 0) {
        scoped = scoped.filter((product) =>
          getSortedActiveVariants(product).some((variant) =>
            selectedAxes.every((axis) => {
              const selectedValues = effectiveSelectedFilterValuesByAxis[axis] ?? [];
              const variantValue = variant.option_values?.[axis] ?? "";
              return selectedValues.includes(variantValue);
            })
          )
        );
      }
    }

    scoped.sort((left, right) => {
      const leftVariants = getSortedActiveVariants(left);
      const rightVariants = getSortedActiveVariants(right);
      const leftRange = getPriceRange(leftVariants);
      const rightRange = getPriceRange(rightVariants);

      if (sortMode === "newest") return right.created_at.localeCompare(left.created_at);
      if (sortMode === "price-asc") return leftRange.minPriceCents - rightRange.minPriceCents;
      if (sortMode === "price-desc") return rightRange.maxPriceCents - leftRange.maxPriceCents;
      if (sortMode === "title-asc") return left.title.localeCompare(right.title);
      if (left.is_featured !== right.is_featured) return left.is_featured ? -1 : 1;
      return right.created_at.localeCompare(left.created_at);
    });

    return scoped;
  })();

  useStorefrontSearchAnalytics({
    query: searchQuery,
    resultCount: filteredProducts.length,
    sortMode,
    availabilityFilter,
    selectedFilterValuesByAxis: effectiveSelectedFilterValuesByAxis,
    view: isProductsView ? "products" : "home",
    enabled: isProductsView && themeConfig.productsShowSearch
  });

  useEffect(() => {
    queueMicrotask(() => {
      const loaded = readStorefrontCart();
      const valid = loaded.filter((entry) => resolvedProducts.some((product) => product.id === entry.productId));
      hasHydratedCartRef.current = true;
      setCart(valid);
    });
  }, [resolvedProducts]);

  useEffect(() => {
    if (!hasHydratedCartRef.current) return;
    const valid = cart.filter((entry) => resolvedProducts.some((product) => product.id === entry.productId));
    writeStorefrontCart(valid);
  }, [cart, resolvedProducts]);

  function addToCart(productId: string) {
    const product = resolvedProducts.find((entry) => entry.id === productId);
    const variant = product ? getDefaultVariant(product) : null;
    if (!product || !variant) return;

    const lineItemKey = `${productId}:${variant.id}`;
    setCart((current) => {
      const existing = current.find((item) => `${item.productId}:${item.variantId}` === lineItemKey);
      const next = existing
        ? current.map((item) =>
          `${item.productId}:${item.variantId}` === lineItemKey ? { ...item, quantity: Math.min(item.quantity + 1, 99) } : item
        )
        : [...current, { productId, variantId: variant.id, quantity: 1 }];
      analytics?.track({
        eventType: "add_to_cart",
        productId,
        value: buildStorefrontAddToCartValue({
          variantId: variant.id,
          quantity: 1,
          unitPriceCents: variant.price_cents,
          source: isProductsView ? "products" : "home"
        })
      });
      void syncStorefrontCart(next, resolvedStore.slug, {
        analyticsSessionId: analytics?.getSessionId() ?? null,
        attribution: analytics?.getAttributionSnapshot() ?? null
      });
      return next;
    });
  }

  const shouldShowHomeHero = view === "home" && themeConfig.homeShowHero;
  const shouldShowHomeContentBlocks = view === "home" && themeConfig.homeShowContentBlocks && themeConfig.showContentBlocks && activeContentBlocks.length > 0;
  const shouldShowHomeProducts = view === "home" && themeConfig.homeShowFeaturedProducts;
  const shouldShowProductsFilters = isProductsView && showFilters;
  const shouldRenderFilterPanel = shouldShowProductsFilters && themeConfig.productsFilterLayout === "sidebar";
  const shouldRenderTopFilters = shouldShowProductsFilters && themeConfig.productsFilterLayout === "topbar";
  const heroBadgeFields = [
    { key: "badgeOne", value: themeConfig.heroBadgeOne, placeholder: "Hero badge 1" },
    { key: "badgeTwo", value: themeConfig.heroBadgeTwo, placeholder: "Hero badge 2" },
    { key: "badgeThree", value: themeConfig.heroBadgeThree, placeholder: "Hero badge 3" }
  ] as const;
  const heroBadges = heroBadgeFields.filter((entry) => entry.value.trim().length > 0);

  function updateHomeField(path: string, value: string) {
    if (!studioDocument) {
      return;
    }

    studioDocument.setSectionDraft("home", (current) => setStorefrontStudioHomeField(current, path, value));
  }

  function updateHomeContentBlock(blockId: string, updates: Record<string, unknown>) {
    if (!studioDocument) {
      return;
    }

    studioDocument.setSectionDraft("home", (current) => updateStorefrontStudioHomeContentBlock(current, blockId, updates));
  }

  useEffect(() => {
    if (!emailStudio) {
      return;
    }

    const scrollRoot = document.querySelector<HTMLElement>("[data-storefront-scroll-root='true']");
    const newsletter = document.getElementById("storefront-newsletter-module");
    if (!scrollRoot || !newsletter) {
      return;
    }

    requestAnimationFrame(() => {
      const rootTop = scrollRoot.getBoundingClientRect().top;
      const targetTop = newsletter.getBoundingClientRect().top;
      const nextScroll = scrollRoot.scrollTop + (targetTop - rootTop) - 24;
      scrollRoot.scrollTo({ top: Math.max(0, nextScroll), behavior: "smooth" });
    });
  }, [emailStudio, resolvedSettings?.email_capture_enabled]);

  return (
    <div
      style={{ ...storefrontThemeStyle, backgroundImage: "none", backgroundAttachment: "fixed" }}
      className="min-h-screen w-full bg-[color:var(--storefront-bg)] text-[color:var(--storefront-text)] [font-family:var(--storefront-font-body)]"
    >
      {themeConfig.showPolicyStrip && resolvedSettings?.announcement ? (
        <section
          className={
            studioEnabled
              ? "sticky top-0 z-50 w-full bg-[var(--storefront-accent)] px-4 py-2 text-center text-xs font-medium text-[color:var(--storefront-accent-foreground)] sm:px-6"
              : "fixed inset-x-0 top-0 z-[70] w-full bg-[var(--storefront-accent)] px-4 py-2 text-center text-xs font-medium text-[color:var(--storefront-accent-foreground)] sm:px-6"
          }
        >
          {studioEnabled && homeSectionDraft ? (
            <StorefrontStudioEditableText
              value={resolvedSettings.announcement ?? ""}
              placeholder="Add announcement text"
              wrapperClassName="mx-auto max-w-3xl"
              displayClassName="text-center text-xs font-medium text-[color:var(--storefront-accent-foreground)]"
              editorClassName="border-white/60 bg-white/95 text-center text-xs font-medium text-slate-900"
              buttonClassName="border-white/40 bg-[color:var(--storefront-accent-foreground)]/12 text-[color:var(--storefront-accent-foreground)]"
              onChange={(value) => updateHomeField("announcement", value)}
            />
          ) : (
            resolvedSettings.announcement
          )}
        </section>
      ) : null}

      <StorefrontHeader
        storeName={resolvedStore.name}
        logoPath={resolvedBranding?.logo_path}
        showLogo={themeConfig.headerShowLogo}
        showTitle={themeConfig.headerShowTitle}
        containerClassName={getStorefrontPageWidthClass(themeConfig.pageWidth)}
        navItems={headerNavLinks}
        buttonRadiusClass={buttonRadiusClass}
        topOffsetPx={themeConfig.showPolicyStrip && resolvedSettings?.announcement ? 32 : 0}
        rightContent={<StorefrontCartButton storeSlug={resolvedStore.slug} buttonRadiusClass={buttonRadiusClass} ariaLabel={copy.nav.openCartAria} />}
      />

      <main id={MAIN_CONTENT_ID} tabIndex={-1} className={cn(getStorefrontPageShellClass(themeConfig.pageWidth, themeConfig.spacingScale), "focus:outline-none")}>
        {shouldShowHomeHero ? (
          <section className="group/hero space-y-6 border-b border-border/40 pb-8 pt-1 sm:space-y-8 sm:pb-10 sm:pt-2">
            <div
              className={cn(
                "gap-6 sm:gap-8",
                isCenteredHeroLayout ? "mx-auto flex max-w-4xl flex-col items-center text-center" : "grid xl:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)] xl:items-end"
              )}
            >
              <div className={cn("space-y-4 sm:space-y-5", isCenteredHeroLayout ? "flex w-full flex-col items-center" : "max-w-4xl")}>
                {studioEnabled && homeSectionDraft ? (
                  <StorefrontStudioEditableText
                    as="p"
                    value={themeConfig.heroEyebrow}
                    placeholder="Add hero eyebrow"
                    wrapperClassName={cn(
                      "transition",
                      isCenteredHeroLayout && "flex justify-center",
                      themeConfig.heroEyebrow.trim().length === 0 && "opacity-0 group-hover/hero:opacity-100 group-focus-within/hero:opacity-100"
                    )}
                    displayClassName={cn(
                      "text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground",
                      themeConfig.heroEyebrow.trim().length === 0 && "italic text-muted-foreground/75"
                    )}
                    editorClassName="h-10 min-h-0 border-slate-300 bg-white/95 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-900"
                    onChange={(value) => updateHomeField("hero.eyebrow", value)}
                  />
                ) : themeConfig.heroEyebrow.trim().length > 0 ? (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{themeConfig.heroEyebrow}</p>
                ) : null}
                {showHeroImage || (studioEnabled && homeSectionDraft) ? (
                  studioEnabled && homeSectionDraft ? (
                    <StorefrontStudioEditableHeroImage
                      imageUrl={heroImageUrl.trim() || null}
                      alt={`${resolvedStore.name} hero image`}
                      size={themeConfig.heroImageSize}
                      className={cn(isCenteredHeroLayout && "mx-auto")}
                    />
                  ) : (
                    <div className={cn("max-w-fit", isCenteredHeroLayout && "mx-auto")}>
                      <Image
                        src={resolvedHeroImageUrl}
                        alt={`${resolvedStore.name} hero image`}
                        width={960}
                        height={640}
                        loading="eager"
                        unoptimized
                        className={cn(
                          "h-auto w-auto max-w-[72vw] sm:max-w-[420px]",
                          heroImageUrl.trim().length > 0
                            ? themeConfig.heroImageSize === "small"
                              ? "max-h-28 rounded-2xl object-cover shadow-sm sm:max-w-[320px]"
                              : themeConfig.heroImageSize === "large"
                                ? "max-h-48 rounded-2xl object-cover shadow-sm sm:max-h-72 sm:max-w-[520px]"
                                : "max-h-36 rounded-2xl object-cover shadow-sm sm:max-h-52"
                            : "max-h-24 object-contain sm:max-h-28"
                        )}
                      />
                    </div>
                  )
                ) : null}
                {showHeroTitle ? (
                  <StorefrontStudioEditableStoreName
                    value={resolvedStore.name}
                    as="h1"
                    displayClassName="text-3xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl [font-family:var(--storefront-font-heading)]"
                    editorClassName="min-h-[3.25rem] border-slate-300 bg-white/95 text-3xl font-semibold leading-[1.05] text-slate-900 sm:text-5xl lg:text-6xl [font-family:var(--storefront-font-heading)]"
                  />
                ) : null}
                {studioEnabled && homeSectionDraft ? (
                  <StorefrontStudioEditableText
                    as="p"
                    value={themeConfig.heroHeadline}
                    placeholder="Add a hero headline"
                    wrapperClassName={cn("max-w-3xl", isCenteredHeroLayout && "mx-auto")}
                    displayClassName={cn("text-lg leading-snug sm:text-2xl [font-family:var(--storefront-font-heading)]", isCenteredHeroLayout && "text-center")}
                    editorClassName="min-h-[3.25rem] border-slate-300 bg-white/95 text-lg leading-snug sm:text-2xl [font-family:var(--storefront-font-heading)]"
                    onChange={(value) => updateHomeField("hero.headline", value)}
                  />
                ) : themeConfig.heroHeadline.trim().toLowerCase() !== resolvedStore.name.trim().toLowerCase() ? (
                  <p className={cn("max-w-3xl text-lg leading-snug sm:text-2xl [font-family:var(--storefront-font-heading)]", isCenteredHeroLayout && "text-center")}>
                    {themeConfig.heroHeadline}
                  </p>
                ) : null}
                {studioEnabled && homeSectionDraft ? (
                  <StorefrontStudioEditableText
                    as="p"
                    multiline
                    value={themeConfig.heroSubcopy}
                    placeholder="Add supporting hero copy"
                    wrapperClassName={cn("max-w-2xl", isCenteredHeroLayout && "mx-auto")}
                    displayClassName={cn("text-sm leading-relaxed text-muted-foreground sm:text-base", isCenteredHeroLayout && "text-center")}
                    editorClassName="min-h-[7.5rem] border-slate-300 bg-white/95 text-sm leading-relaxed text-slate-900 sm:text-base"
                    onChange={(value) => updateHomeField("hero.subcopy", value)}
                  />
                ) : (
                  <p className={cn("max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base", isCenteredHeroLayout && "text-center")}>
                    {themeConfig.heroSubcopy}
                  </p>
                )}
                {heroBadges.length > 0 || (studioEnabled && homeSectionDraft) ? (
                  <div className={cn("flex flex-wrap gap-2", isCenteredHeroLayout && "justify-center")}>
                    {(studioEnabled && homeSectionDraft ? heroBadgeFields : heroBadges).map((badge, index) =>
                      studioEnabled && homeSectionDraft ? (
                        <StorefrontStudioEditableText
                          key={`${badge.key}-${index}`}
                          as="span"
                          value={badge.value}
                          placeholder={badge.placeholder}
                          wrapperClassName={cn("inline-flex transition", badge.value.trim().length === 0 && "opacity-0 group-hover/hero:opacity-100 group-focus-within/hero:opacity-100")}
                          displayClassName={cn(
                            "inline-flex items-center rounded-full border border-border/60 bg-muted/20 px-3 py-1 text-xs font-medium text-muted-foreground",
                            badge.value.trim().length === 0 && "italic text-muted-foreground/75"
                          )}
                          editorClassName="h-9 min-h-0 rounded-full border-slate-300 bg-white/95 px-3 text-xs font-medium text-slate-900"
                          onChange={(value) => updateHomeField(`hero.${badge.key}`, value)}
                        />
                      ) : (
                        <span key={`${badge.key}-${index}`} className="inline-flex items-center rounded-full border border-border/60 bg-muted/20 px-3 py-1 text-xs font-medium text-muted-foreground">
                          {badge.value}
                        </span>
                      )
                    )}
                  </div>
                ) : null}
                <div className={cn("flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap sm:items-center", isCenteredHeroLayout && "sm:justify-center")}>
                  {studioEnabled && homeSectionDraft ? (
                    <>
                      <StorefrontStudioEditableLink
                        label={copy.home.shopProductsCta}
                        url={copy.home.shopProductsUrl}
                        labelPlaceholder="Primary CTA label"
                        urlPlaceholder="/s/your-store/products"
                        emptyLabel="Add primary CTA"
                        displayClassName={cn(getPrimaryCtaClass(themeConfig, buttonRadiusClass), "w-full justify-center sm:w-auto")}
                        placeholderClassName={cn(getPrimaryCtaClass(themeConfig, buttonRadiusClass), "w-full justify-center border-dashed opacity-75 sm:w-auto")}
                        onChange={(next) => {
                          updateHomeField("copy.home.shopProductsCta", next.label);
                          updateHomeField("copy.home.shopProductsUrl", next.url);
                        }}
                      />
                      <StorefrontStudioEditableLink
                        label={copy.home.aboutBrandCta}
                        url={copy.home.aboutBrandUrl}
                        labelPlaceholder="Secondary CTA label"
                        urlPlaceholder="/s/your-store/about"
                        emptyLabel="Add secondary CTA"
                        displayClassName={cn(
                          STOREFRONT_TEXT_LINK_EFFECT_CLASS,
                          "h-10 justify-center px-3 text-sm text-muted-foreground hover:text-[color:var(--storefront-text)] sm:justify-start",
                          buttonRadiusClass
                        )}
                        placeholderClassName={cn(
                          "inline-flex h-10 items-center justify-center border border-dashed border-border/70 px-3 text-sm text-muted-foreground sm:justify-start",
                          buttonRadiusClass
                        )}
                        onChange={(next) => {
                          updateHomeField("copy.home.aboutBrandCta", next.label);
                          updateHomeField("copy.home.aboutBrandUrl", next.url);
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <Link href={shopProductsHref} className={cn(getPrimaryCtaClass(themeConfig, buttonRadiusClass), "w-full justify-center sm:w-auto")}>
                        {copy.home.shopProductsCta}
                      </Link>
                      <Link
                        href={aboutBrandHref}
                        className={cn(
                          STOREFRONT_TEXT_LINK_EFFECT_CLASS,
                          "h-10 justify-center px-3 text-sm text-muted-foreground hover:text-[color:var(--storefront-text)] sm:justify-start",
                          buttonRadiusClass
                        )}
                      >
                        {copy.home.aboutBrandCta}
                      </Link>
                    </>
                  )}
                </div>
              </div>

              <div
                className={cn(
                  "space-y-2 border-t border-border/50 pt-4 text-xs text-muted-foreground",
                  isCenteredHeroLayout ? "mx-auto w-full max-w-xl text-center" : "xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0"
                )}
              >
                {studioEnabled && homeSectionDraft ? (
                  <StorefrontStudioEditableText
                    as="p"
                    value={copy.home.storeNotesLabel}
                    placeholder="Store notes label"
                    displayClassName={cn("text-[11px] font-semibold uppercase tracking-[0.16em]", isCenteredHeroLayout && "text-center")}
                    editorClassName="h-9 min-h-0 border-slate-300 bg-white/95 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-900"
                    onChange={(value) => updateHomeField("copy.home.storeNotesLabel", value)}
                  />
                ) : (
                  <p className={cn("text-[11px] font-semibold uppercase tracking-[0.16em]", isCenteredHeroLayout && "text-center")}>{copy.home.storeNotesLabel}</p>
                )}
                {studioEnabled && homeSectionDraft ? (
                  <StorefrontStudioEditableText
                    as="p"
                    multiline
                    value={resolvedSettings?.fulfillment_message ?? ""}
                    placeholder="Add fulfillment message"
                    displayClassName={cn("text-sm leading-relaxed text-[color:var(--storefront-text)]", isCenteredHeroLayout && "text-center")}
                    editorClassName="min-h-[7rem] border-slate-300 bg-white/95 text-sm leading-relaxed text-slate-900"
                    onChange={(value) => updateHomeField("fulfillmentMessage", value)}
                  />
                ) : resolvedSettings?.fulfillment_message ? (
                  <p className={cn("text-sm leading-relaxed text-[color:var(--storefront-text)]", isCenteredHeroLayout && "text-center")}>
                    {resolvedSettings.fulfillment_message}
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {shouldShowHomeContentBlocks ? (
          <section
            className="group/content-blocks space-y-4 border-b border-border/40 pb-8"
            onMouseEnter={() => setShowAllHomeContentBlocks(true)}
            onMouseLeave={() => setShowAllHomeContentBlocks(false)}
            onFocusCapture={() => setShowAllHomeContentBlocks(true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setShowAllHomeContentBlocks(false);
              }
            }}
          >
            {shouldShowContentBlocksHeading ? (
              studioEnabled && homeSectionDraft ? (
                <StorefrontStudioEditableText
                  as="h2"
                  value={copy.home.contentBlocksHeading}
                  placeholder="Add section heading"
                  displayClassName="text-2xl font-semibold [font-family:var(--storefront-font-heading)]"
                  editorClassName="min-h-[3.25rem] border-slate-300 bg-white/95 text-2xl font-semibold [font-family:var(--storefront-font-heading)] text-slate-900"
                  onChange={(value) => updateHomeField("copy.home.contentBlocksHeading", value)}
                />
              ) : (
                <h2 className="text-2xl font-semibold [font-family:var(--storefront-font-heading)]">{copy.home.contentBlocksHeading}</h2>
              )
            ) : null}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {visibleContentBlocks.map((block, index) => (
                <StorefrontStudioSelectableRegion
                  key={block.id}
                  selection={{ kind: "home-content-block", id: block.id }}
                  label="Content block"
                  className="-mx-3 px-3"
                  accessory={
                    studioEnabled ? (
                      <StorefrontStudioHomeContentBlockActions
                        blockId={block.id}
                        canMoveUp={index > 0}
                        canMoveDown={index < visibleContentBlocks.length - 1}
                        isVisible={block.is_active}
                        onToggleVisibility={() => updateHomeContentBlock(block.id, { isActive: !block.is_active })}
                      />
                    ) : null
                  }
                >
                  <article className={cn("relative space-y-2 border-t border-border/50 pt-3", !block.is_active && "opacity-55")}>
                    {studioEnabled && homeSectionDraft ? (
                      <StorefrontStudioEditableText
                        as="p"
                        value={block.eyebrow ?? ""}
                        placeholder="Add block eyebrow"
                        displayClassName="text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
                        editorClassName="h-9 min-h-0 border-slate-300 bg-white/95 text-[10px] uppercase tracking-[0.2em] text-slate-900"
                        onChange={(value) => updateHomeContentBlock(block.id, { eyebrow: value })}
                      />
                    ) : block.eyebrow ? (
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{block.eyebrow}</p>
                    ) : null}
                    {studioEnabled && homeSectionDraft ? (
                      <StorefrontStudioEditableText
                        as="h3"
                        value={block.title}
                        placeholder="Add block title"
                        displayClassName="text-xl leading-tight [font-family:var(--storefront-font-heading)]"
                        editorClassName="min-h-[3rem] border-slate-300 bg-white/95 text-xl leading-tight [font-family:var(--storefront-font-heading)] text-slate-900"
                        onChange={(value) => updateHomeContentBlock(block.id, { title: value })}
                      />
                    ) : (
                      <h3 className="text-xl leading-tight [font-family:var(--storefront-font-heading)]">{block.title}</h3>
                    )}
                    {studioEnabled && homeSectionDraft ? (
                      <StorefrontStudioEditableText
                        as="p"
                        multiline
                        value={block.body}
                        placeholder="Add block body"
                        displayClassName="text-sm leading-relaxed text-muted-foreground"
                        editorClassName="min-h-[7rem] border-slate-300 bg-white/95 text-sm leading-relaxed text-slate-900"
                        onChange={(value) => updateHomeContentBlock(block.id, { body: value })}
                      />
                    ) : (
                      <p className="text-sm leading-relaxed text-muted-foreground">{block.body}</p>
                    )}
                    {studioEnabled && homeSectionDraft ? (
                      <StorefrontStudioEditableLink
                        label={block.cta_label ?? ""}
                        url={block.cta_url ?? ""}
                        labelPlaceholder="CTA label"
                        urlPlaceholder="/collections/new"
                        emptyLabel="Add CTA"
                        displayClassName={cn(STOREFRONT_TEXT_LINK_EFFECT_CLASS, "text-sm font-medium")}
                        placeholderClassName="inline-flex items-center text-sm font-medium text-muted-foreground"
                        onChange={(next) => updateHomeContentBlock(block.id, { ctaLabel: next.label, ctaUrl: next.url })}
                      />
                    ) : block.cta_label && block.cta_url ? (
                      <a href={block.cta_url} className={cn(STOREFRONT_TEXT_LINK_EFFECT_CLASS, "text-sm font-medium")}>
                        {block.cta_label}
                      </a>
                    ) : null}
                  </article>
                </StorefrontStudioSelectableRegion>
              ))}
              {studioEnabled && homeSectionDraft ? (
                <button
                  type="button"
                  className="flex min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/10 text-muted-foreground opacity-0 transition hover:border-primary/45 hover:bg-primary/5 hover:text-foreground group-hover/content-blocks:opacity-100 group-focus-within/content-blocks:opacity-100"
                  aria-label="Add content block"
                  onClick={() => {
                    const newBlock = {
                      id: `block-${crypto.randomUUID()}`,
                      sortOrder: activeContentBlocks.length,
                      eyebrow: "",
                      title: "",
                      body: "",
                      ctaLabel: "",
                      ctaUrl: "",
                      isActive: true
                    };
                    studioDocument?.setSectionDraft("home", (current) => {
                      const currentBlocks = Array.isArray(current.contentBlocks) ? current.contentBlocks : [];
                      return setEditorValueAtPath(current, "contentBlocks", [...currentBlocks, newBlock]);
                    });
                    studioDocument?.setSelection({ kind: "home-content-block", id: newBlock.id });
                  }}
                >
                  <span className="flex flex-col items-center gap-2 text-sm font-medium">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-current/25">
                      +
                    </span>
                    Add content block
                  </span>
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {(isProductsView || shouldShowHomeProducts) ? (
          <section className="space-y-3">
            {isProductsView ? (
              <div className="flex justify-start">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-expanded={showFilters}
                  aria-label={showFilters ? copy.home.hideFiltersAria : copy.home.showFiltersAria}
                  title={showFilters ? copy.home.hideFiltersAria : copy.home.showFiltersAria}
                  onClick={() => setShowFilters((current) => !current)}
                  className={cn("gap-2", buttonRadiusClass)}
                >
                  {showFilters ? <FilterX className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
                  <span>{showFilters ? "Hide filters" : "Show filters"}</span>
                </Button>
              </div>
            ) : null}

            {shouldRenderTopFilters ? (
              <div className={cn("grid gap-3 p-3 sm:p-4", radiusClass, cardClass, isIntegrated ? "border-0 bg-transparent shadow-none" : "border border-border")}>
                {studioEnabled && isProductsView ? (
                  <StorefrontStudioEditableText
                    as="p"
                    value={copy.home.browseFilterTitle}
                    placeholder="Filter panel title"
                    displayClassName="text-sm font-semibold"
                    onChange={(value) => updateProductsField("copy.home.browseFilterTitle", value)}
                  />
                ) : (
                  <p className="text-sm font-semibold">{copy.home.browseFilterTitle}</p>
                )}
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {themeConfig.productsShowSearch ? (
                    <label className="grid gap-1">
                      <span className="text-xs font-medium text-muted-foreground">{copy.home.searchLabel}</span>
                      {studioEnabled && isProductsView ? (
                        <StorefrontStudioEditableInputPlaceholder
                          value={searchQuery}
                          onValueChange={setSearchQuery}
                          placeholder={copy.home.searchPlaceholder}
                          onPlaceholderChange={(value) => updateProductsField("copy.home.searchPlaceholder", value)}
                          inputClassName={buttonRadiusClass}
                          panelClassName={radiusClass}
                        />
                      ) : (
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder={copy.home.searchPlaceholder}
                            className={cn("pl-9", buttonRadiusClass)}
                          />
                        </div>
                      )}
                    </label>
                  ) : null}
                  {themeConfig.productsShowSort ? (
                    <label className="grid gap-1">
                      <span className="text-xs font-medium text-muted-foreground">{copy.home.sortLabel}</span>
                      <Select
                        value={sortMode}
                        onChange={(event) => setSortMode(event.target.value as ProductSortMode)}
                        className={buttonRadiusClass}
                      >
                        <option value="featured">{copy.sort.featuredFirst}</option>
                        <option value="newest">{copy.sort.newestFirst}</option>
                        <option value="price-asc">{copy.sort.priceLowToHigh}</option>
                        <option value="price-desc">{copy.sort.priceHighToLow}</option>
                        <option value="title-asc">{copy.sort.nameAToZ}</option>
                      </Select>
                    </label>
                  ) : null}
                  {themeConfig.productsShowAvailability ? (
                    <label className="grid gap-1">
                      <span className="text-xs font-medium text-muted-foreground">{copy.home.availabilityLabel}</span>
                      <Select
                        value={availabilityFilter}
                        onChange={(event) => setAvailabilityFilter(event.target.value as AvailabilityFilterMode)}
                        className={buttonRadiusClass}
                      >
                        <option value="all">{copy.availabilityFilter.all}</option>
                        <option value="in-stock">{copy.availabilityFilter.inStock}</option>
                        <option value="made-to-order">{copy.availabilityFilter.madeToOrder}</option>
                      </Select>
                    </label>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn("w-full self-end md:w-auto", buttonRadiusClass)}
                    onClick={() => {
                      setSearchQuery("");
                      setAvailabilityFilter("all");
                      setSelectedFilterValuesByAxis({});
                      setSortMode("featured");
                    }}
                  >
                    {copy.home.resetFilters}
                  </Button>
                </div>
              </div>
            ) : null}

            <div className={cn("grid", shouldRenderFilterPanel ? "xl:grid-cols-[280px_1fr]" : "xl:grid-cols-1", containerGapClasses[themeConfig.spacingScale])}>
              {shouldRenderFilterPanel ? (
                <aside
                  className={cn(
                    "h-fit space-y-3 p-3 sm:p-4",
                    radiusClass,
                    cardClass,
                    isIntegrated ? "border-0 bg-transparent shadow-none" : "border border-border",
                    "xl:sticky xl:top-24"
                  )}
                >
                  {studioEnabled && isProductsView ? (
                    <StorefrontStudioEditableText
                      as="p"
                      value={copy.home.browseFilterTitle}
                      placeholder="Filter panel title"
                      displayClassName="text-sm font-semibold"
                      onChange={(value) => updateProductsField("copy.home.browseFilterTitle", value)}
                    />
                  ) : (
                    <p className="text-sm font-semibold">{copy.home.browseFilterTitle}</p>
                  )}
                  {hasFeaturedProducts ? <p className="text-xs text-muted-foreground">{copy.home.featuredIncludedNote}</p> : null}
                  {themeConfig.productsShowSearch ? (
                    <label className="grid gap-1">
                      <span className="text-xs font-medium text-muted-foreground">{copy.home.searchLabel}</span>
                      {studioEnabled && isProductsView ? (
                        <StorefrontStudioEditableInputPlaceholder
                          value={searchQuery}
                          onValueChange={setSearchQuery}
                          placeholder={copy.home.searchPlaceholder}
                          onPlaceholderChange={(value) => updateProductsField("copy.home.searchPlaceholder", value)}
                          inputClassName={buttonRadiusClass}
                          panelClassName={radiusClass}
                        />
                      ) : (
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder={copy.home.searchPlaceholder}
                            className={cn("pl-9", buttonRadiusClass)}
                          />
                        </div>
                      )}
                    </label>
                  ) : null}
                  {themeConfig.productsShowSort ? (
                    <label className="grid gap-1">
                      <span className="text-xs font-medium text-muted-foreground">{copy.home.sortLabel}</span>
                      <Select
                        value={sortMode}
                        onChange={(event) => setSortMode(event.target.value as ProductSortMode)}
                        className={buttonRadiusClass}
                      >
                        <option value="featured">{copy.sort.featuredFirst}</option>
                        <option value="newest">{copy.sort.newestFirst}</option>
                        <option value="price-asc">{copy.sort.priceLowToHigh}</option>
                        <option value="price-desc">{copy.sort.priceHighToLow}</option>
                        <option value="title-asc">{copy.sort.nameAToZ}</option>
                      </Select>
                    </label>
                  ) : null}
                  {themeConfig.productsShowAvailability ? (
                    <label className="grid gap-1">
                      <span className="text-xs font-medium text-muted-foreground">{copy.home.availabilityLabel}</span>
                      <Select
                        value={availabilityFilter}
                        onChange={(event) => setAvailabilityFilter(event.target.value as AvailabilityFilterMode)}
                        className={buttonRadiusClass}
                      >
                        <option value="all">{copy.availabilityFilter.all}</option>
                        <option value="in-stock">{copy.availabilityFilter.inStock}</option>
                        <option value="made-to-order">{copy.availabilityFilter.madeToOrder}</option>
                      </Select>
                    </label>
                  ) : null}
                  {themeConfig.productsShowOptionFilters ? (
                    <>
                      {availableAxisNames.map((axis) => {
                        const options = availableAxisValuesByName[axis] ?? [];
                        const selectedValues = effectiveSelectedFilterValuesByAxis[axis] ?? [];
                        return (
                          <div
                            key={axis}
                            className={cn(
                              "space-y-2 p-2",
                              radiusClass,
                              isIntegrated ? "border-t border-border/60 first:border-t-0" : "border border-border bg-[color:var(--storefront-surface)]"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-medium text-muted-foreground">{axis}</p>
                              {selectedValues.length > 0 ? (
                                <button
                                  type="button"
                                  className="text-[11px] font-medium text-primary underline-offset-4 hover:underline"
                                  onClick={() =>
                                    setSelectedFilterValuesByAxis((current) => {
                                      const next = { ...current };
                                      delete next[axis];
                                      return next;
                                    })
                                  }
                                >
                                  Clear
                                </button>
                              ) : null}
                            </div>
                            <div className="space-y-1">
                              {options.map((value) => {
                                const checked = selectedValues.includes(value);
                                return (
                                  <label key={`${axis}-${value}`} className="flex items-center gap-2 text-xs">
                                    <Checkbox
                                      checked={checked}
                                      onChange={(event) =>
                                        setSelectedFilterValuesByAxis((current) => {
                                          const axisValues = new Set(current[axis] ?? []);
                                          if (event.target.checked) axisValues.add(value);
                                          else axisValues.delete(value);
                                          const next = { ...current };
                                          const resolved = [...axisValues];
                                          if (resolved.length === 0) delete next[axis];
                                          else next[axis] = resolved;
                                          return next;
                                        })
                                      }
                                    />
                                    <span>{value}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn("w-full", buttonRadiusClass)}
                    onClick={() => {
                      setSearchQuery("");
                      setAvailabilityFilter("all");
                      setSelectedFilterValuesByAxis({});
                      setSortMode("featured");
                    }}
                  >
                    {copy.home.resetFilters}
                  </Button>
                </aside>
              ) : null}

              <div id="products" className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  {!isProductsView && studioEnabled && homeSectionDraft ? (
                    <StorefrontStudioEditableText
                      as="h2"
                      value={copy.home.featuredProductsHeading}
                      placeholder="Featured products heading"
                      displayClassName="text-xl font-semibold"
                      editorClassName="min-h-[3rem] border-slate-300 bg-white/95 text-xl font-semibold text-slate-900"
                      onChange={(value) => updateHomeField("copy.home.featuredProductsHeading", value)}
                    />
                  ) : isProductsView && studioEnabled && productsSectionDraft ? (
                    <StorefrontStudioEditableText
                      as="h2"
                      value={copy.home.shopProductsHeading}
                      placeholder="Products heading"
                      displayClassName="text-xl font-semibold"
                      editorClassName="min-h-[3rem] border-slate-300 bg-white/95 text-xl font-semibold text-slate-900"
                      onChange={(value) => updateProductsField("copy.home.shopProductsHeading", value)}
                    />
                  ) : (
                    <h2 className="text-xl font-semibold">{!isProductsView ? copy.home.featuredProductsHeading : copy.home.shopProductsHeading}</h2>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {filteredProducts.length} {copy.home.shownSuffix}
                  </p>
                </div>

                {filteredProducts.length === 0 ? (
                  <div className={cn("space-y-3 p-4 text-sm text-muted-foreground", radiusClass, cardClass, isIntegrated ? "border-0" : "border border-border")}>
                    {studioEnabled && isProductsView ? (
                      <StorefrontStudioEditableText
                        as="p"
                        multiline
                        value={copy.home.noProductsMatch}
                        placeholder="No results message"
                        displayClassName="text-sm text-muted-foreground"
                        onChange={(value) => updateProductsField("copy.home.noProductsMatch", value)}
                      />
                    ) : (
                      <p>{copy.home.noProductsMatch}</p>
                    )}
                  </div>
                ) : (
                  <div className={productGridClasses[themeConfig.productGridColumns]}>
                    {filteredProducts.map((product) => {
                      const variants = getSortedActiveVariants(product);
                      const defaultVariant = getDefaultVariant(product);
                      const optionNames = getVariantOptionNames(product, variants);
                      const hasConfigurableChoices = optionNames.length > 0 || variants.length > 1;
                      const cardImages = getVariantImages(defaultVariant, product);
                      const cardPriceCents = defaultVariant?.price_cents ?? 0;
                      const shortDescription = truncateWithEllipsis(toPlainText(product.description), 160);
                      const canQuickAdd = Boolean(defaultVariant && (defaultVariant.is_made_to_order || defaultVariant.inventory_qty > 0));

                      return (
                        <article
                          key={product.id}
                          className={cn(
                            "group relative space-y-3 pb-4",
                            cardClass,
                            radiusClass,
                            isIntegrated ? "border-0" : "border border-border/60 p-3 sm:p-4"
                          )}
                        >
                          <Link href={buildProductHref(product, resolvedStore.slug)} className="block space-y-3">
                            {cardImages.length > 0 ? (
                              <StorefrontImageCarousel
                                key={`${product.id}:${cardImages.join("|")}`}
                                images={cardImages}
                                alt={product.image_alt_text || `${product.title} image`}
                                imageClassName={cn("aspect-square w-full", isIntegrated ? "" : "border border-border/60")}
                                showArrowsOnHover
                                allowPointerSwipe={false}
                                hoverZoom={themeConfig.productCardImageHoverZoom}
                                showArrows={themeConfig.productCardShowCarouselArrows}
                                showDots={themeConfig.productCardShowCarouselDots}
                                imageFit={themeConfig.productCardImageFit}
                              />
                            ) : null}
                          </Link>
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link href={buildProductHref(product, resolvedStore.slug)} className={cn(STOREFRONT_TEXT_LINK_EFFECT_CLASS, "font-semibold")}>
                                {product.title}
                              </Link>
                            </div>
                            {themeConfig.productCardShowDescription ? (
                              <p
                                className="text-sm leading-relaxed text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] overflow-hidden"
                                style={{ WebkitLineClamp: themeConfig.productCardDescriptionLines }}
                              >
                                {shortDescription || copy.home.noDescriptionYet}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-0.5">
                              <p className="font-medium">${(cardPriceCents / 100).toFixed(2)}</p>
                              {themeConfig.productCardShowAvailability ? (
                                <p className="text-xs text-muted-foreground">
                                  {hasConfigurableChoices
                                    ? `${variants.length} ${copy.productDetail.optionsLabel.toLowerCase()}`
                                    : getAvailabilityLabel(defaultVariant, null, copy)}
                                </p>
                              ) : null}
                            </div>
                            {themeConfig.productCardShowQuickAdd ? (
                              <Button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  addToCart(product.id);
                                }}
                                disabled={!canQuickAdd}
                                className={cn("h-9 w-full px-3 bg-[var(--storefront-primary)] text-[color:var(--storefront-primary-foreground)] hover:opacity-90 sm:w-auto", buttonRadiusClass)}
                              >
                                {copy.home.addButton}
                              </Button>
                            ) : null}
                          </div>
                          {themeConfig.productCardShowFeaturedBadge && product.is_featured ? (
                            <span
                              className={cn(
                                "pointer-events-none absolute right-2 top-2 z-10 border border-border/70 bg-[color:var(--storefront-surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--storefront-text)]/80",
                                buttonRadiusClass
                              )}
                            >
                              {copy.home.featuredBadge}
                            </span>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        <div className="space-y-8">
          {themeConfig.reviewsShowOnHome && reviewsEnabled ? (
            <StorefrontReviewsSection
              storeSlug={resolvedStore.slug}
              buttonRadiusClass={buttonRadiusClass}
              reviewCardClassName={cardClass}
              reviewsTheme={themeConfig}
              reviewsCopy={copy.reviews}
              studio={isProductsView ? reviewsStudio : undefined}
            />
          ) : null}
          <StorefrontFooter
            storeName={resolvedStore.name}
            storeSlug={resolvedStore.slug}
            viewer={resolvedViewer}
            settings={resolvedSettings}
            buttonRadiusClass={buttonRadiusClass}
            surfaceRadiusClassName={radiusClass}
            surfaceCardClassName={cardClass}
            copy={copy}
            navLinks={footerNavLinks}
            showBackToTop={themeConfig.showFooterBackToTop}
            showOwnerLogin={themeConfig.showFooterOwnerLogin}
            studio={footerStudio}
          />
        </div>
      </main>
    </div>
  );
}
