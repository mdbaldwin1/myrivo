"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { readStorefrontCart, writeStorefrontCart, type StorefrontCartEntry } from "@/lib/storefront/cart";
import { formatCopyTemplate, resolveStorefrontCopy } from "@/lib/storefront/copy";
import { STOREFRONT_TEXT_LINK_EFFECT_CLASS } from "@/lib/storefront/link-effects";
import { resolveFooterNavLinks, resolveHeaderNavLinks } from "@/lib/storefront/navigation";

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
};

type AvailabilityFilterMode = "all" | "in-stock" | "made-to-order";
type ProductSortMode = "featured" | "newest" | "price-asc" | "price-desc" | "title-asc";

const pageWidthClasses = {
  narrow: "max-w-5xl",
  standard: "max-w-6xl",
  wide: "max-w-7xl"
} as const;

const spacingClasses = {
  compact: "space-y-5 px-4 py-8 sm:px-6",
  comfortable: "space-y-8 px-6 py-10",
  airy: "space-y-10 px-6 py-12"
} as const;

const containerGapClasses = {
  compact: "gap-4",
  comfortable: "gap-6",
  airy: "gap-8"
} as const;

const radiusClasses = {
  soft: "rounded-2xl",
  rounded: "rounded-xl",
  sharp: "rounded-none"
} as const;

const buttonRadiusClasses = {
  soft: "!rounded-2xl",
  rounded: "!rounded-xl",
  sharp: "!rounded-none"
} as const;

const cardStyleClasses = {
  solid: "border border-border bg-[color:var(--storefront-surface)] shadow-sm",
  outline: "border-2 border-border bg-transparent",
  elevated: "border border-border bg-[color:var(--storefront-surface)] shadow-[0_10px_28px_rgba(var(--storefront-primary-rgb),0.18)]",
  integrated: "border-0 bg-transparent shadow-none"
} as const;

const productGridClasses = {
  2: "grid gap-5 sm:grid-cols-2",
  3: "grid gap-5 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
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
  return `/products/${key}?store=${encodeURIComponent(storeSlug)}`;
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

export function StorefrontPage(props: StorefrontPageProps) {
  const { store, viewer, branding, settings, products, contentBlocks, view = "home" } = props;
  const themeConfig = resolveStorefrontThemeConfig(branding?.theme_json ?? {});
  const copy = resolveStorefrontCopy(settings?.storefront_copy_json ?? {});
  const headerNavLinks = resolveHeaderNavLinks(themeConfig, copy, store.slug);
  const footerNavLinks = resolveFooterNavLinks(themeConfig, copy, store.slug);

  const [cart, setCart] = useState<StorefrontCartEntry[]>([]);
  const hasHydratedCartRef = useRef(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilterMode>("all");
  const [selectedFilterValuesByAxis, setSelectedFilterValuesByAxis] = useState<Record<string, string[]>>({});
  const [sortMode, setSortMode] = useState<ProductSortMode>("featured");
  const [showFilters, setShowFilters] = useState(themeConfig.productsFiltersDefaultOpen);
  const homeFeaturedProductsLimit = themeConfig.homeFeaturedProductsLimit;
  const productsShowAvailability = themeConfig.productsShowAvailability;
  const productsShowOptionFilters = themeConfig.productsShowOptionFilters;

  const hasBrandLogo = Boolean(branding?.logo_path);
  const showHeroTitle = themeConfig.heroBrandDisplay !== "logo" || !hasBrandLogo;
  const storefrontThemeStyle = buildStorefrontThemeStyle({
    primaryColor: branding?.primary_color,
    accentColor: branding?.accent_color,
    themeConfig
  });

  const radiusClass = radiusClasses[themeConfig.radiusScale];
  const cardClass = cardStyleClasses[themeConfig.cardStyle];
  const isIntegrated = themeConfig.cardStyle === "integrated";
  const buttonRadiusClass = buttonRadiusClasses[themeConfig.radiusScale];
  const isProductsView = view === "products";

  const hasFeaturedProducts = products.some((product) => product.is_featured);
  const activeContentBlocks = contentBlocks.filter((block) => block.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const shouldShowContentBlocksHeading = (activeContentBlocks[0]?.title.trim().toLowerCase() ?? "") !== "our approach";

  const availableAxisNames = useMemo(() => {
    const names = new Set<string>();
    for (const product of products) {
      for (const variant of getSortedActiveVariants(product)) {
        for (const name of Object.keys(variant.option_values ?? {})) {
          names.add(name);
        }
      }
    }
    return [...names].sort((left, right) => left.localeCompare(right));
  }, [products]);

  const availableAxisValuesByName = useMemo(() => {
    const valuesByAxis: Record<string, string[]> = {};
    for (const axis of availableAxisNames) {
      const values = new Set<string>();
      for (const product of products) {
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
  }, [availableAxisNames, products]);

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
    let scoped = [...products];

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

  useEffect(() => {
    queueMicrotask(() => {
      const loaded = readStorefrontCart();
      const valid = loaded.filter((entry) => products.some((product) => product.id === entry.productId));
      hasHydratedCartRef.current = true;
      setCart(valid);
    });
  }, [products]);

  useEffect(() => {
    if (!hasHydratedCartRef.current) return;
    const valid = cart.filter((entry) => products.some((product) => product.id === entry.productId));
    writeStorefrontCart(valid);
  }, [cart, products]);

  function addToCart(productId: string) {
    const product = products.find((entry) => entry.id === productId);
    const variant = product ? getDefaultVariant(product) : null;
    if (!product || !variant) return;

    const lineItemKey = `${productId}:${variant.id}`;
    setCart((current) => {
      const existing = current.find((item) => `${item.productId}:${item.variantId}` === lineItemKey);
      if (existing) {
        return current.map((item) =>
          `${item.productId}:${item.variantId}` === lineItemKey ? { ...item, quantity: Math.min(item.quantity + 1, 99) } : item
        );
      }
      return [...current, { productId, variantId: variant.id, quantity: 1 }];
    });
  }

  const shouldShowHomeHero = view === "home" && themeConfig.homeShowHero;
  const shouldShowHomeContentBlocks = view === "home" && themeConfig.homeShowContentBlocks && themeConfig.showContentBlocks && activeContentBlocks.length > 0;
  const shouldShowHomeProducts = view === "home" && themeConfig.homeShowFeaturedProducts;
  const shouldShowProductsFilters = isProductsView && showFilters;
  const shouldRenderFilterPanel = shouldShowProductsFilters && themeConfig.productsFilterLayout === "sidebar";
  const shouldRenderTopFilters = shouldShowProductsFilters && themeConfig.productsFilterLayout === "topbar";

  return (
    <div
      style={{ ...storefrontThemeStyle, backgroundImage: "none", backgroundAttachment: "fixed" }}
      className="min-h-screen w-full bg-[color:var(--storefront-bg)] text-[color:var(--storefront-text)] [font-family:var(--storefront-font-body)]"
    >
      {themeConfig.showPolicyStrip && settings?.announcement ? (
        <section className="fixed inset-x-0 top-0 z-[70] w-full bg-[var(--storefront-accent)] px-4 py-2 text-center text-xs font-medium text-[color:var(--storefront-accent-foreground)] sm:px-6">
          {settings.announcement}
        </section>
      ) : null}

      <StorefrontHeader
        storeName={store.name}
        logoPath={branding?.logo_path}
        showTitle={themeConfig.heroBrandDisplay !== "logo" || !branding?.logo_path}
        containerClassName={pageWidthClasses[themeConfig.pageWidth]}
        navItems={headerNavLinks}
        buttonRadiusClass={buttonRadiusClass}
        topOffsetPx={themeConfig.showPolicyStrip && settings?.announcement ? 32 : 0}
        rightContent={<StorefrontCartButton storeSlug={store.slug} buttonRadiusClass={buttonRadiusClass} ariaLabel={copy.nav.openCartAria} />}
      />

      <main className={cn("mx-auto w-full", pageWidthClasses[themeConfig.pageWidth], spacingClasses[themeConfig.spacingScale])}>
        {shouldShowHomeHero ? (
          <section className="space-y-6 border-b border-border/40 pb-10 pt-2">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
              <div className="max-w-4xl space-y-5">
                {showHeroTitle ? (
                  <h1 className="text-4xl font-semibold leading-[1.05] sm:text-6xl [font-family:var(--storefront-font-heading)]">{store.name}</h1>
                ) : null}
                {themeConfig.heroHeadline.trim().toLowerCase() !== store.name.trim().toLowerCase() ? (
                  <p className="max-w-3xl text-xl leading-snug sm:text-2xl [font-family:var(--storefront-font-heading)]">{themeConfig.heroHeadline}</p>
                ) : null}
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{themeConfig.heroSubcopy}</p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Link href={`/products?store=${encodeURIComponent(store.slug)}`} className={getPrimaryCtaClass(themeConfig, buttonRadiusClass)}>
                    {copy.home.shopProductsCta}
                  </Link>
                  <Link
                    href={`/about?store=${encodeURIComponent(store.slug)}`}
                    className={cn(
                      STOREFRONT_TEXT_LINK_EFFECT_CLASS,
                      "h-10 px-3 text-sm text-muted-foreground hover:text-[color:var(--storefront-text)]",
                      buttonRadiusClass
                    )}
                  >
                    {copy.home.aboutBrandCta}
                  </Link>
                </div>
              </div>

              <div className="space-y-2 border-l border-border/50 pl-4 text-xs text-muted-foreground">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">{copy.home.storeNotesLabel}</p>
                {settings?.fulfillment_message ? <p className="text-sm leading-relaxed text-[color:var(--storefront-text)]">{settings.fulfillment_message}</p> : null}
              </div>
            </div>
          </section>
        ) : null}

        {shouldShowHomeContentBlocks ? (
          <section className="space-y-4 border-b border-border/40 pb-8">
            {shouldShowContentBlocksHeading ? (
              <h2 className="text-2xl font-semibold [font-family:var(--storefront-font-heading)]">{copy.home.contentBlocksHeading}</h2>
            ) : null}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {activeContentBlocks.map((block) => (
                <article key={block.id} className="space-y-2 border-t border-border/50 pt-3">
                  {block.eyebrow ? <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{block.eyebrow}</p> : null}
                  <h3 className="text-xl leading-tight [font-family:var(--storefront-font-heading)]">{block.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{block.body}</p>
                  {block.cta_label && block.cta_url ? (
                    <a href={block.cta_url} className={cn(STOREFRONT_TEXT_LINK_EFFECT_CLASS, "text-sm font-medium")}>
                      {block.cta_label}
                    </a>
                  ) : null}
                </article>
              ))}
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
                  size="icon"
                  aria-expanded={showFilters}
                  aria-label={showFilters ? copy.home.hideFiltersAria : copy.home.showFiltersAria}
                  title={showFilters ? copy.home.hideFiltersAria : copy.home.showFiltersAria}
                  onClick={() => setShowFilters((current) => !current)}
                  className={buttonRadiusClass}
                >
                  {showFilters ? <Filter className="h-4 w-4" /> : <FilterX className="h-4 w-4" />}
                </Button>
              </div>
            ) : null}

            {shouldRenderTopFilters ? (
              <div className={cn("grid gap-3 p-3", radiusClass, cardClass, isIntegrated ? "border-0 bg-transparent shadow-none" : "border border-border")}>
                <p className="text-sm font-semibold">{copy.home.browseFilterTitle}</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {themeConfig.productsShowSearch ? (
                    <label className="grid gap-1">
                      <span className="text-xs font-medium text-muted-foreground">{copy.home.searchLabel}</span>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={copy.home.searchPlaceholder} className="pl-9" />
                      </div>
                    </label>
                  ) : null}
                  {themeConfig.productsShowSort ? (
                    <label className="grid gap-1">
                      <span className="text-xs font-medium text-muted-foreground">{copy.home.sortLabel}</span>
                      <Select value={sortMode} onChange={(event) => setSortMode(event.target.value as ProductSortMode)}>
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
                      <Select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value as AvailabilityFilterMode)}>
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
                    className={cn("self-end", buttonRadiusClass)}
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

            <div className={cn("grid", shouldRenderFilterPanel ? "lg:grid-cols-[260px_1fr]" : "lg:grid-cols-1", containerGapClasses[themeConfig.spacingScale])}>
              {shouldRenderFilterPanel ? (
                <aside className={cn("h-fit space-y-3 p-3", radiusClass, cardClass, isIntegrated ? "border-0 bg-transparent shadow-none" : "border border-border")}>
                  <p className="text-sm font-semibold">{copy.home.browseFilterTitle}</p>
                  {hasFeaturedProducts ? <p className="text-xs text-muted-foreground">{copy.home.featuredIncludedNote}</p> : null}
                  {themeConfig.productsShowSearch ? (
                    <label className="grid gap-1">
                      <span className="text-xs font-medium text-muted-foreground">{copy.home.searchLabel}</span>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={copy.home.searchPlaceholder} className="pl-9" />
                      </div>
                    </label>
                  ) : null}
                  {themeConfig.productsShowSort ? (
                    <label className="grid gap-1">
                      <span className="text-xs font-medium text-muted-foreground">{copy.home.sortLabel}</span>
                      <Select value={sortMode} onChange={(event) => setSortMode(event.target.value as ProductSortMode)}>
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
                      <Select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value as AvailabilityFilterMode)}>
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
                          <div key={axis} className={cn("space-y-2 rounded-md p-2", isIntegrated ? "border-t border-border/60 first:border-t-0" : "border border-border bg-[color:var(--storefront-surface)]")}>
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xl font-semibold">{!isProductsView ? copy.home.featuredProductsHeading : copy.home.shopProductsHeading}</h2>
                  <p className="text-xs text-muted-foreground">
                    {filteredProducts.length} {copy.home.shownSuffix}
                  </p>
                </div>

                {filteredProducts.length === 0 ? (
                  <div className={cn("space-y-3 p-4 text-sm text-muted-foreground", radiusClass, cardClass, isIntegrated ? "border-0" : "border border-border")}>
                    <p>{copy.home.noProductsMatch}</p>
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
                            "group relative space-y-3 pb-5",
                            cardClass,
                            isIntegrated ? "border-0" : "border border-border/60 p-4"
                          )}
                        >
                          <Link href={buildProductHref(product, store.slug)} className="block space-y-3">
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
                              <Link href={buildProductHref(product, store.slug)} className={cn(STOREFRONT_TEXT_LINK_EFFECT_CLASS, "font-semibold")}>
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
                          <div className="flex items-center justify-between gap-3 pt-1">
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
                                className={cn("h-9 px-3 bg-[var(--storefront-primary)] text-[color:var(--storefront-primary-foreground)] hover:opacity-90", buttonRadiusClass)}
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
          {themeConfig.reviewsShowOnHome ? (
            <StorefrontReviewsSection
              storeSlug={store.slug}
              buttonRadiusClass={buttonRadiusClass}
              reviewCardClassName={cardClass}
              reviewsTheme={themeConfig}
              reviewsCopy={copy.reviews}
            />
          ) : null}
          <StorefrontFooter
            storeName={store.name}
            storeSlug={store.slug}
            viewer={viewer}
            settings={settings}
            buttonRadiusClass={buttonRadiusClass}
            copy={copy}
            navLinks={footerNavLinks}
            showBackToTop={themeConfig.showFooterBackToTop}
            showOwnerLogin={themeConfig.showFooterOwnerLogin}
          />
        </div>
      </main>
    </div>
  );
}
