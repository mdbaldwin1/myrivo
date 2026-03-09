"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { buildStorefrontThemeStyle, resolveStorefrontThemeConfig } from "@/lib/theme/storefront-theme";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import { formatVariantLabel } from "@/lib/products/variants";
import { readStorefrontCart, writeStorefrontCart } from "@/lib/storefront/cart";
import { cn } from "@/lib/utils";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { StorefrontImageCarousel } from "@/components/storefront/storefront-image-carousel";
import { StorefrontCartButton } from "@/components/storefront/storefront-cart-button";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";
import { StorefrontReviewsSection } from "@/components/storefront/storefront-reviews-section";
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

type Props = {
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
    announcement: string | null;
    fulfillment_message: string | null;
    support_email: string | null;
    footer_tagline: string | null;
    footer_note: string | null;
    instagram_url: string | null;
    facebook_url: string | null;
    tiktok_url: string | null;
    storefront_copy_json?: Record<string, unknown> | null;
  } | null;
  product: StorefrontProduct;
};

const pageWidthClasses = {
  narrow: "max-w-5xl",
  standard: "max-w-6xl",
  wide: "max-w-7xl"
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

function resolveAvailableValuesForOption(
  variants: StorefrontVariant[],
  optionNames: string[],
  selectedValues: Record<string, string>,
  targetOptionName: string
) {
  const values = new Set<string>();

  for (const variant of variants) {
    const matchesOtherSelections = optionNames
      .filter((name) => name !== targetOptionName)
      .every((name) => {
        const selected = selectedValues[name];
        if (!selected) {
          return true;
        }
        return (variant.option_values?.[name] ?? "") === selected;
      });

    if (!matchesOtherSelections) {
      continue;
    }

    const value = variant.option_values?.[targetOptionName];
    if (value) {
      values.add(value);
    }
  }

  if (values.size > 0) {
    return [...values];
  }

  for (const variant of variants) {
    const value = variant.option_values?.[targetOptionName];
    if (value) {
      values.add(value);
    }
  }

  return [...values];
}

function resolveVariantForOptionSelection(
  variants: StorefrontVariant[],
  optionNames: string[],
  nextSelectedValues: Record<string, string>,
  fallbackVariant: StorefrontVariant | null
) {
  const exactMatch = variants.find((variant) =>
    optionNames.every((name) => (variant.option_values?.[name] ?? "") === (nextSelectedValues[name] ?? ""))
  );
  if (exactMatch) {
    return exactMatch;
  }

  const scored = variants
    .map((variant) => ({
      variant,
      score: optionNames.reduce((score, name) => {
        if ((variant.option_values?.[name] ?? "") === (nextSelectedValues[name] ?? "")) {
          return score + 1;
        }
        return score;
      }, 0)
    }))
    .sort((left, right) => right.score - left.score);

  return scored[0]?.variant ?? fallbackVariant;
}

function resolveVariantLabel(variant: StorefrontVariant) {
  return formatVariantLabel(variant, "Default");
}

function getVariantImages(variant: StorefrontVariant | null, product: StorefrontProduct) {
  const ordered = [...(variant?.image_urls ?? []), ...(variant?.group_image_urls ?? []), ...(product.image_urls ?? [])].filter(
    (image): image is string => Boolean(image)
  );
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const image of ordered) {
    if (seen.has(image)) continue;
    seen.add(image);
    unique.push(image);
  }
  return unique;
}

function getAvailabilityLabel(
  variant: StorefrontVariant | null,
  fulfillmentMessage: string | null,
  copy: ReturnType<typeof resolveStorefrontCopy>
) {
  if (!variant) return copy.availability.unavailable;
  const isMadeToOrderActive = variant.is_made_to_order && variant.inventory_qty < 1;
  if (isMadeToOrderActive) {
    return fulfillmentMessage
      ? formatCopyTemplate(copy.availability.madeToOrderWithFulfillmentTemplate, { message: fulfillmentMessage })
      : copy.availability.madeToOrder;
  }
  if (variant.inventory_qty <= 0) return copy.availability.outOfStock;
  return `${variant.inventory_qty} ${copy.availability.inStockSuffix}`;
}

export function StorefrontProductDetailPage({ store, viewer, branding, settings, product }: Props) {
  const themeConfig = resolveStorefrontThemeConfig(branding?.theme_json ?? {});
  const copy = resolveStorefrontCopy(settings?.storefront_copy_json ?? {});
  const headerNavLinks = resolveHeaderNavLinks(themeConfig, copy, store.slug);
  const footerNavLinks = resolveFooterNavLinks(themeConfig, copy, store.slug);
  const buttonRadiusClass = buttonRadiusClasses[themeConfig.radiusScale];
  const cardClass = cardStyleClasses[themeConfig.cardStyle];
  const storefrontThemeStyle = buildStorefrontThemeStyle({
    primaryColor: branding?.primary_color,
    accentColor: branding?.accent_color,
    themeConfig
  });

  const variants = useMemo(() => getSortedActiveVariants(product), [product]);
  const defaultVariant = useMemo(() => getDefaultVariant(product), [product]);
  const optionNames = useMemo(() => getVariantOptionNames(product, variants), [product, variants]);
  const [selectedVariantId, setSelectedVariantId] = useState(defaultVariant?.id ?? "");

  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) ?? defaultVariant;
  const selectedOptionValues = selectedVariant?.option_values ?? {};
  const images = getVariantImages(selectedVariant, product);
  const canPurchaseSelectedVariant = Boolean(selectedVariant && (selectedVariant.is_made_to_order || selectedVariant.inventory_qty > 0));

  function addToCart() {
    if (!selectedVariant) {
      return;
    }
    const current = readStorefrontCart();
    const key = `${product.id}:${selectedVariant.id}`;
    const existing = current.find((item) => `${item.productId}:${item.variantId}` === key);
    const next = existing
      ? current.map((item) =>
          `${item.productId}:${item.variantId}` === key ? { ...item, quantity: Math.min(item.quantity + 1, 99) } : item
        )
      : [...current, { productId: product.id, variantId: selectedVariant.id, quantity: 1 }];
    writeStorefrontCart(next);
  }

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
        rightContent={<StorefrontCartButton storeSlug={store.slug} ariaLabel={copy.nav.openCartAria} buttonRadiusClass={buttonRadiusClass} />}
      />

      <main className={cn("mx-auto grid w-full gap-8 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_420px]", pageWidthClasses[themeConfig.pageWidth])}>
        <div className="space-y-4">
          <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <Link href={`/products?store=${encodeURIComponent(store.slug)}`} className={STOREFRONT_TEXT_LINK_EFFECT_CLASS}>
              {copy.productDetail.breadcrumbProducts}
            </Link>
            <span className="px-2">/</span>
            <span>{product.title}</span>
          </div>
          {images.length > 0 ? (
            <StorefrontImageCarousel
              images={images}
              alt={product.image_alt_text || `${product.title} image`}
              imageClassName={`aspect-square w-full ${buttonRadiusClass}`}
            />
          ) : null}
        </div>

        <section className="space-y-5">
          <h1 className="text-4xl font-semibold leading-tight [font-family:var(--storefront-font-heading)]">{product.title}</h1>
          <div className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(product.description) }} />

          {optionNames.length > 0 ? (
            <div className="space-y-4 border-t border-border/60 pt-4">
              {optionNames.map((optionName) => {
                const values = resolveAvailableValuesForOption(variants, optionNames, selectedOptionValues, optionName);
                const selectedValue = selectedOptionValues[optionName] ?? values[0] ?? "";
                return (
                  <div key={optionName} className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{optionName}</p>
                    <div className="flex flex-wrap gap-2.5">
                      {values.map((value) => (
                        <button
                          key={`${optionName}-${value}`}
                          type="button"
                          className={cn(
                            "rounded-full border border-border px-3.5 py-1.5 text-sm transition-colors",
                            buttonRadiusClass,
                            selectedValue === value
                              ? "bg-[var(--storefront-primary)] text-[color:var(--storefront-primary-foreground)]"
                              : "bg-[color:var(--storefront-surface)] hover:bg-muted/40"
                          )}
                          onClick={() => {
                            const nextSelectedValues = { ...selectedOptionValues, [optionName]: value };
                            const nextVariant = resolveVariantForOptionSelection(variants, optionNames, nextSelectedValues, selectedVariant ?? null);
                            if (!nextVariant) return;
                            setSelectedVariantId(nextVariant.id);
                          }}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : variants.length > 1 ? (
            <label className="grid gap-1 border-t border-border/60 pt-4">
              <span className="text-xs font-medium text-muted-foreground">{copy.productDetail.optionsLabel}</span>
              <Select value={selectedVariant?.id ?? ""} onChange={(event) => setSelectedVariantId(event.target.value)}>
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {resolveVariantLabel(variant)}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}

          <div className="space-y-2 border-t border-border/60 pt-4">
            <p className="text-2xl font-semibold">${((selectedVariant?.price_cents ?? 0) / 100).toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">{getAvailabilityLabel(selectedVariant ?? null, settings?.fulfillment_message ?? null, copy)}</p>
          </div>

          <Button
            type="button"
            onClick={addToCart}
            disabled={!canPurchaseSelectedVariant}
            className={cn("h-11 w-full bg-[var(--storefront-primary)] text-[color:var(--storefront-primary-foreground)] hover:opacity-90", buttonRadiusClass)}
          >
            {!selectedVariant
              ? copy.productDetail.outOfStockButton
              : selectedVariant.is_made_to_order && selectedVariant.inventory_qty < 1
                ? copy.productDetail.addToCartMadeToOrder
                : selectedVariant.inventory_qty <= 0
                  ? copy.productDetail.outOfStockButton
                  : copy.productDetail.addToCart}
          </Button>

          <Link href={`/products?store=${encodeURIComponent(store.slug)}`} className={cn(STOREFRONT_TEXT_LINK_EFFECT_CLASS, "text-sm font-medium")}>
            {copy.productDetail.backToAllProducts}
          </Link>
        </section>

        <div className="space-y-8 lg:col-span-2">
          {themeConfig.reviewsShowOnProductDetail ? (
            <StorefrontReviewsSection
              storeSlug={store.slug}
              productId={product.id}
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
            copy={copy}
            buttonRadiusClass={buttonRadiusClass}
            navLinks={footerNavLinks}
            showBackToTop={themeConfig.showFooterBackToTop}
            showOwnerLogin={themeConfig.showFooterOwnerLogin}
          />
        </div>
      </main>
    </div>
  );
}
