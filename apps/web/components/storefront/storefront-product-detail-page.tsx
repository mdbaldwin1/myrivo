"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { StorefrontStudioEditableButtonLabel } from "@/components/storefront/storefront-studio-editable-button-label";
import { StorefrontStudioEditableLink } from "@/components/storefront/storefront-studio-editable-link";
import { StorefrontStudioEditableTemplateText } from "@/components/storefront/storefront-studio-editable-template-text";
import { StorefrontStudioEditableText } from "@/components/storefront/storefront-studio-editable-text";
import { buildStorefrontThemeStyle, resolveStorefrontThemeConfig } from "@/lib/theme/storefront-theme";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import { formatVariantLabel } from "@/lib/products/variants";
import { setEditorValueAtPath } from "@/lib/store-editor/object-path";
import { readStorefrontCart, syncStorefrontCart, writeStorefrontCart } from "@/lib/storefront/cart";
import { cn } from "@/lib/utils";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { StorefrontImageCarousel } from "@/components/storefront/storefront-image-carousel";
import { StorefrontCartButton } from "@/components/storefront/storefront-cart-button";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";
import { StorefrontBackInStockAlertForm } from "@/components/storefront/storefront-back-in-stock-alert-form";
import { StorefrontReviewsSection } from "@/components/storefront/storefront-reviews-section";
import { MAIN_CONTENT_ID } from "@/lib/accessibility";
import { useOptionalStorefrontRuntime } from "@/components/storefront/storefront-runtime-provider";
import { useOptionalStorefrontAnalytics } from "@/components/storefront/storefront-analytics-provider";
import { useStorefrontPageView, useStorefrontProductView } from "@/components/storefront/use-storefront-analytics-events";
import { buildStorefrontAddToCartValue } from "@/lib/analytics/storefront-instrumentation";
import { formatCopyTemplate, resolveStorefrontCopy } from "@/lib/storefront/copy";
import { getStorefrontButtonRadiusClass, getStorefrontCardStyleClass, getStorefrontRadiusClass } from "@/lib/storefront/appearance";
import { getStorefrontPageWidthClass } from "@/lib/storefront/layout";
import { STOREFRONT_TEXT_LINK_EFFECT_CLASS } from "@/lib/storefront/link-effects";
import { resolveFooterNavLinks, resolveHeaderNavLinks } from "@/lib/storefront/navigation";
import { buildStorefrontProductsPath } from "@/lib/storefront/paths";
import { resolveStorefrontPresentation } from "@/lib/storefront/presentation";

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
  reviewsEnabled?: boolean;
};

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

export function resolveAvailableValuesForOption(
  variants: StorefrontVariant[],
  optionNames: string[],
  selectedValues: Record<string, string>,
  targetOptionName: string
) {
  const values = new Set<string>();
  const targetIndex = optionNames.findIndex((name) => name === targetOptionName);
  const constrainedOptionNames = targetIndex <= 0 ? [] : optionNames.slice(0, targetIndex);

  for (const variant of variants) {
    const matchesOtherSelections = constrainedOptionNames
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

function getAvailabilityCopyField(variant: StorefrontVariant | null) {
  if (!variant) {
    return "unavailable" as const;
  }

  if (variant.is_made_to_order && variant.inventory_qty < 1) {
    return "madeToOrderWithFulfillmentTemplate" as const;
  }

  if (variant.inventory_qty <= 0) {
    return "outOfStock" as const;
  }

  return "inStockSuffix" as const;
}

export function StorefrontProductDetailPage({ store, viewer, branding, settings, product, reviewsEnabled = true }: Props) {
  const runtime = useOptionalStorefrontRuntime();
  const studioDocument = useOptionalStorefrontStudioDocument();
  const analytics = useOptionalStorefrontAnalytics();
  const resolvedStore = runtime?.store ?? store;
  const resolvedViewer = runtime?.viewer ?? viewer;
  const resolvedBranding = runtime?.branding ?? branding;
  const resolvedPresentation = runtime ? resolveStorefrontPresentation(runtime) : null;
  const resolvedSettings = resolvedPresentation?.settings ?? settings;
  const resolvedProduct =
    runtime?.products.find((entry) => entry.id === product.id || entry.slug === product.slug || entry.slug === product.id) ?? product;
  const themeConfig = resolvedPresentation?.themeConfig ?? resolveStorefrontThemeConfig(resolvedBranding?.theme_json ?? {});
  const copy = resolvedPresentation?.copy ?? resolveStorefrontCopy(resolvedSettings?.storefront_copy_json ?? {});
  const routeBasePath = runtime?.routeBasePath ?? "";
  const headerNavLinks = resolveHeaderNavLinks(themeConfig, copy, resolvedStore.slug, routeBasePath);
  const footerNavLinks = resolveFooterNavLinks(themeConfig, copy, resolvedStore.slug, routeBasePath);
  const radiusClass = getStorefrontRadiusClass(themeConfig.radiusScale);
  const buttonRadiusClass = getStorefrontButtonRadiusClass(themeConfig.radiusScale);
  const cardClass = getStorefrontCardStyleClass(themeConfig.cardStyle);
  const isIntegrated = themeConfig.cardStyle === "integrated";
  const studioEnabled = runtime?.mode === "studio";
  const storefrontThemeStyle = buildStorefrontThemeStyle({
    primaryColor: resolvedBranding?.primary_color,
    accentColor: resolvedBranding?.accent_color,
    themeConfig
  });

  const variants = useMemo(() => getSortedActiveVariants(resolvedProduct), [resolvedProduct]);
  const defaultVariant = useMemo(() => getDefaultVariant(resolvedProduct), [resolvedProduct]);
  const optionNames = useMemo(() => getVariantOptionNames(resolvedProduct, variants), [resolvedProduct, variants]);
  const [selectedVariantId, setSelectedVariantId] = useState(defaultVariant?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [addToCartState, setAddToCartState] = useState<"idle" | "adding" | "added">("idle");
  const addToCartResetTimeoutRef = useRef<number | null>(null);

  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) ?? defaultVariant;
  const selectedOptionValues = selectedVariant?.option_values ?? {};
  const images = getVariantImages(selectedVariant, resolvedProduct);
  const canPurchaseSelectedVariant = Boolean(selectedVariant && (selectedVariant.is_made_to_order || selectedVariant.inventory_qty > 0));
  const studioEnabledWithDocument = studioEnabled && Boolean(studioDocument);
  const availabilityField = getAvailabilityCopyField(selectedVariant ?? null);
  const availabilityLabel = getAvailabilityLabel(selectedVariant ?? null, resolvedSettings?.fulfillment_message ?? null, copy);
  const baseAddToCartLabel = !selectedVariant
    ? copy.productDetail.outOfStockButton
    : selectedVariant.is_made_to_order && selectedVariant.inventory_qty < 1
      ? copy.productDetail.addToCartMadeToOrder
      : selectedVariant.inventory_qty <= 0
        ? copy.productDetail.outOfStockButton
        : copy.productDetail.addToCart;
  const addToCartLabel =
    addToCartState === "adding"
      ? copy.productDetail.addingToCart
      : addToCartState === "added"
        ? copy.productDetail.addedToCart
        : baseAddToCartLabel;

  useStorefrontPageView("product_detail", {
    productId: resolvedProduct.id,
    productSlug: resolvedProduct.slug || resolvedProduct.id
  });
  useStorefrontProductView(resolvedProduct.id, {
    productSlug: resolvedProduct.slug || resolvedProduct.id
  });

  function updateProductsField(path: string, value: string) {
    studioDocument?.setSectionDraft("productsPage", (current) => setEditorValueAtPath(current, path, value));
  }

  const reviewsStudio = studioEnabledWithDocument
    ? {
        enabled: true,
        onSectionTitleChange: (value: string) => updateProductsField("copy.reviews.sectionTitle", value),
        onSummaryTemplateChange: (value: string) => updateProductsField("copy.reviews.summaryTemplate", value),
        onEmptyStateChange: (value: string) => updateProductsField("copy.reviews.emptyState", value),
        onLoadMoreChange: (value: string) => updateProductsField("copy.reviews.loadMore", value),
        onFormTitleChange: (value: string) => updateProductsField("copy.reviews.formTitle", value)
      }
    : undefined;

  useEffect(() => {
    return () => {
      if (addToCartResetTimeoutRef.current) {
        clearTimeout(addToCartResetTimeoutRef.current);
      }
    };
  }, []);

  async function addToCart() {
    if (!selectedVariant) {
      return;
    }
    setAddToCartState("adding");
    const current = readStorefrontCart();
    const key = `${resolvedProduct.id}:${selectedVariant.id}`;
    const existing = current.find((item) => `${item.productId}:${item.variantId}` === key);
    const next = existing
      ? current.map((item) =>
          `${item.productId}:${item.variantId}` === key ? { ...item, quantity: Math.min(item.quantity + quantity, 99) } : item
        )
      : [...current, { productId: resolvedProduct.id, variantId: selectedVariant.id, quantity }];
    analytics?.track({
      eventType: "add_to_cart",
      productId: resolvedProduct.id,
      value: buildStorefrontAddToCartValue({
        variantId: selectedVariant.id,
        quantity,
        unitPriceCents: selectedVariant.price_cents,
        source: "product_detail"
      })
    });
    writeStorefrontCart(next);
    await syncStorefrontCart(next, resolvedStore.slug, {
      analyticsSessionId: analytics?.getSessionId() ?? null,
      attribution: analytics?.getAttributionSnapshot() ?? null
    });
    setAddToCartState("added");
    if (addToCartResetTimeoutRef.current) {
      clearTimeout(addToCartResetTimeoutRef.current);
    }
    addToCartResetTimeoutRef.current = window.setTimeout(() => {
      setAddToCartState("idle");
      addToCartResetTimeoutRef.current = null;
    }, 1600);
  }

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
          {resolvedSettings.announcement}
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
        rightContent={<StorefrontCartButton storeSlug={resolvedStore.slug} ariaLabel={copy.nav.openCartAria} buttonRadiusClass={buttonRadiusClass} />}
      />

      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className={cn(
          "mx-auto grid w-full gap-8 px-4 py-7 focus:outline-none sm:gap-10 sm:px-6 sm:py-9 lg:py-10 xl:grid-cols-[minmax(0,1.08fr)_minmax(20rem,0.92fr)] xl:items-start",
          getStorefrontPageWidthClass(themeConfig.pageWidth)
        )}
      >
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-wrap items-center gap-y-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground sm:text-xs">
            {studioEnabledWithDocument ? (
              <StorefrontStudioEditableLink
                label={copy.productDetail.breadcrumbProducts}
                url={buildStorefrontProductsPath(resolvedStore.slug, routeBasePath)}
                hideUrlField
                allowNavigation
                labelPlaceholder="Products"
                urlPlaceholder=""
                emptyLabel="Products"
                wrapperClassName="align-middle"
                displayClassName={STOREFRONT_TEXT_LINK_EFFECT_CLASS}
                onChange={(next) => updateProductsField("copy.productDetail.breadcrumbProducts", next.label)}
              />
            ) : (
              <Link href={buildStorefrontProductsPath(resolvedStore.slug, routeBasePath)} className={STOREFRONT_TEXT_LINK_EFFECT_CLASS}>
                {copy.productDetail.breadcrumbProducts}
              </Link>
            )}
            <span className="px-2">/</span>
            <span>{resolvedProduct.title}</span>
          </div>
          {images.length > 0 ? (
            <StorefrontImageCarousel
              images={images}
              alt={resolvedProduct.image_alt_text || `${resolvedProduct.title} image`}
              imageClassName={cn("aspect-[4/4.4] w-full sm:aspect-square xl:aspect-[1/1.05]", buttonRadiusClass)}
            />
          ) : null}
        </div>

        <section className="space-y-5 sm:space-y-6 xl:pl-2">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl lg:text-[2.75rem] [font-family:var(--storefront-font-heading)]">
              {resolvedProduct.title}
            </h1>
            <div
              data-rich-text-content="true"
              className="text-sm leading-6 text-muted-foreground sm:text-[15px]"
              dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(resolvedProduct.description) }}
            />
          </div>

          {optionNames.length > 0 ? (
            <div className={cn("space-y-4 p-4 sm:p-5", radiusClass, cardClass, isIntegrated ? "border border-border/60 bg-[color:var(--storefront-surface)]/70 shadow-sm" : "")}>
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
                            "rounded-full border border-border px-3.5 py-2 text-sm transition-colors",
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
            <label className={cn("grid gap-1 p-4 sm:p-5", radiusClass, cardClass, isIntegrated ? "border border-border/60 bg-[color:var(--storefront-surface)]/70 shadow-sm" : "")}>
              <Select value={selectedVariant?.id ?? ""} onChange={(event) => setSelectedVariantId(event.target.value)}>
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {resolveVariantLabel(variant)}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}

          <div className={cn("space-y-4 p-4 sm:p-5", radiusClass, cardClass, isIntegrated ? "border border-border/60 bg-[color:var(--storefront-surface)] shadow-sm" : "")}>
            <div className="space-y-2">
              <p className="text-2xl font-semibold sm:text-[1.8rem]">${((selectedVariant?.price_cents ?? 0) / 100).toFixed(2)}</p>
              {studioEnabledWithDocument ? (
                availabilityField === "madeToOrderWithFulfillmentTemplate" ? (
                  <StorefrontStudioEditableTemplateText
                    renderedValue={availabilityLabel}
                    templateValue={copy.availability.madeToOrderWithFulfillmentTemplate}
                    placeholder="Made to order • {message}"
                    fieldLabel="Availability template"
                    helperTokens={["{message}"]}
                    helperExample="Example: Made to order • {message}"
                    displayClassName="text-sm text-muted-foreground"
                    onChange={(value) => updateProductsField("copy.availability.madeToOrderWithFulfillmentTemplate", value)}
                  />
                ) : availabilityField === "inStockSuffix" ? (
                  <StorefrontStudioEditableText
                    as="p"
                    value={copy.availability.inStockSuffix}
                    placeholder="in stock"
                    displayClassName="text-sm text-muted-foreground"
                    editorClassName="h-10 min-h-0 border-slate-300 bg-white/95 text-sm text-slate-900"
                    onChange={(value) => updateProductsField("copy.availability.inStockSuffix", value)}
                  />
                ) : (
                  <StorefrontStudioEditableText
                    as="p"
                    value={availabilityField === "unavailable" ? copy.availability.unavailable : copy.availability.outOfStock}
                    placeholder="Availability message"
                    displayClassName="text-sm text-muted-foreground"
                    editorClassName="h-10 min-h-0 border-slate-300 bg-white/95 text-sm text-slate-900"
                    onChange={(value) =>
                      updateProductsField(
                        availabilityField === "unavailable" ? "copy.availability.unavailable" : "copy.availability.outOfStock",
                        value
                      )
                    }
                  />
                )
              ) : (
                <p className="text-sm text-muted-foreground">{availabilityLabel}</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Quantity</p>
              <div className={cn("inline-flex w-fit items-center overflow-hidden border border-border/60 bg-[color:var(--storefront-surface)]", buttonRadiusClass)}>
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  className="inline-flex h-10 w-10 items-center justify-center text-lg text-muted-foreground transition hover:bg-muted/30 hover:text-[color:var(--storefront-text)] disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                  disabled={quantity <= 1}
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  max={99}
                  inputMode="numeric"
                  value={quantity}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (!Number.isFinite(next)) {
                      setQuantity(1);
                      return;
                    }
                    setQuantity(Math.max(1, Math.min(99, Math.trunc(next))));
                  }}
                  className="h-10 w-14 border-x border-border/60 bg-transparent text-center text-sm font-medium outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  aria-label="Increase quantity"
                  className="inline-flex h-10 w-10 items-center justify-center text-lg text-muted-foreground transition hover:bg-muted/30 hover:text-[color:var(--storefront-text)] disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => setQuantity((current) => Math.min(99, current + 1))}
                  disabled={quantity >= 99}
                >
                  +
                </button>
              </div>
            </div>

            <div className="relative">
              <Button
                type="button"
                onClick={() => void addToCart()}
                disabled={!canPurchaseSelectedVariant || addToCartState !== "idle"}
                className={cn(
                  "h-11 w-full bg-[var(--storefront-primary)] text-[color:var(--storefront-primary-foreground)] hover:opacity-90",
                  buttonRadiusClass
                )}
              >
                {addToCartLabel}
              </Button>
              {studioEnabledWithDocument ? (
                <StorefrontStudioEditableButtonLabel
                  label={addToCartLabel}
                  placeholder="Button label"
                  allowPointerThrough
                  wrapperClassName="absolute inset-0 flex items-center justify-center"
                  labelClassName="inline-flex items-center justify-center text-sm font-medium text-[color:var(--storefront-primary-foreground)]"
                  panelClassName="left-1/2 top-[calc(100%+0.5rem)] -translate-x-1/2"
                  onChange={(value) => {
                    if (!selectedVariant) {
                      updateProductsField("copy.productDetail.outOfStockButton", value);
                      return;
                    }

                    if (selectedVariant.is_made_to_order && selectedVariant.inventory_qty < 1) {
                      updateProductsField("copy.productDetail.addToCartMadeToOrder", value);
                      return;
                    }

                    if (selectedVariant.inventory_qty <= 0) {
                      updateProductsField("copy.productDetail.outOfStockButton", value);
                      return;
                    }

                    updateProductsField("copy.productDetail.addToCart", value);
                  }}
                />
              ) : null}
            </div>

            {selectedVariant && !selectedVariant.is_made_to_order && selectedVariant.inventory_qty <= 0 ? (
              <StorefrontBackInStockAlertForm
                storeSlug={resolvedStore.slug}
                productId={resolvedProduct.id}
                variantId={selectedVariant.id}
                variantLabel={resolveVariantLabel(selectedVariant)}
                buttonRadiusClass={buttonRadiusClass}
              />
            ) : null}

            {studioEnabledWithDocument ? (
              <StorefrontStudioEditableLink
                label={copy.productDetail.backToAllProducts}
                url={buildStorefrontProductsPath(resolvedStore.slug, routeBasePath)}
                hideUrlField
                allowNavigation
                labelPlaceholder="Back to all products"
                urlPlaceholder=""
                emptyLabel="Back to all products"
                wrapperClassName="align-middle"
                displayClassName={cn(STOREFRONT_TEXT_LINK_EFFECT_CLASS, "text-sm font-medium")}
                onChange={(next) => updateProductsField("copy.productDetail.backToAllProducts", next.label)}
              />
            ) : (
              <Link href={buildStorefrontProductsPath(resolvedStore.slug, routeBasePath)} className={cn(STOREFRONT_TEXT_LINK_EFFECT_CLASS, "text-sm font-medium")}>
                {copy.productDetail.backToAllProducts}
              </Link>
            )}
          </div>
        </section>

        <div className="space-y-8 xl:col-span-2">
          {themeConfig.reviewsShowOnProductDetail && reviewsEnabled ? (
            <StorefrontReviewsSection
              storeSlug={resolvedStore.slug}
              productId={resolvedProduct.id}
              buttonRadiusClass={buttonRadiusClass}
              reviewCardClassName={cardClass}
              reviewsTheme={themeConfig}
              reviewsCopy={copy.reviews}
              studio={reviewsStudio}
            />
          ) : null}
          <StorefrontFooter
            storeName={resolvedStore.name}
            storeSlug={resolvedStore.slug}
            viewer={resolvedViewer}
            settings={resolvedSettings}
            copy={copy}
            buttonRadiusClass={buttonRadiusClass}
            surfaceRadiusClassName={radiusClass}
            surfaceCardClassName={cardClass}
            navLinks={footerNavLinks}
            showBackToTop={themeConfig.showFooterBackToTop}
            showOwnerLogin={themeConfig.showFooterOwnerLogin}
          />
        </div>
      </main>
    </div>
  );
}
