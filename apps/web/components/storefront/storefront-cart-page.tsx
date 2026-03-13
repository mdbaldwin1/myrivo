"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildStorefrontThemeStyle, resolveStorefrontThemeConfig } from "@/lib/theme/storefront-theme";
import { formatVariantLabel } from "@/lib/products/variants";
import { readStorefrontCart, syncStorefrontCart, writeStorefrontCart, type StorefrontCartEntry } from "@/lib/storefront/cart";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { StorefrontCartButton } from "@/components/storefront/storefront-cart-button";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";
import { StorefrontPrivacyCollectionNotice } from "@/components/storefront/storefront-privacy-collection-notice";
import { StorefrontStudioEditableButtonLabel } from "@/components/storefront/storefront-studio-editable-button-label";
import { StorefrontStudioEditableText } from "@/components/storefront/storefront-studio-editable-text";
import { useOptionalStorefrontRuntime } from "@/components/storefront/storefront-runtime-provider";
import { useOptionalStorefrontAnalytics } from "@/components/storefront/storefront-analytics-provider";
import { useStorefrontPageView } from "@/components/storefront/use-storefront-analytics-events";
import { MAIN_CONTENT_ID } from "@/lib/accessibility";
import { cn } from "@/lib/utils";
import { buildStorefrontCartAnalyticsValue } from "@/lib/analytics/storefront-instrumentation";
import { getStorefrontButtonRadiusClass, getStorefrontCardStyleClass, getStorefrontRadiusClass } from "@/lib/storefront/appearance";
import { resolveStorefrontCopy } from "@/lib/storefront/copy";
import { getStorefrontPageWidthClass } from "@/lib/storefront/layout";
import { STOREFRONT_TEXT_LINK_EFFECT_CLASS } from "@/lib/storefront/link-effects";
import { resolveFooterNavLinks, resolveHeaderNavLinks } from "@/lib/storefront/navigation";
import { resolveStorefrontPresentation } from "@/lib/storefront/presentation";

type StorefrontVariant = {
  id: string;
  title: string | null;
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
  slug: string;
  image_urls?: string[] | null;
  image_alt_text?: string | null;
  product_variants: StorefrontVariant[];
};

type CheckoutResponse = {
  mode?: "checkout";
  checkoutUrl?: string;
  orderId?: string;
  paymentMode?: string;
  error?: string;
};

type PromoPreviewResponse = {
  promoCode?: string;
  discountCents?: number;
  error?: string;
};

type PickupOptionsResponse = {
  pickupEnabled?: boolean;
  selectionMode?: "buyer_select" | "hidden_nearest";
  options?: Array<{
    id: string;
    name: string;
    distanceMiles: number;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    stateRegion: string;
    postalCode: string;
    countryCode: string;
  }>;
  selectedLocationId?: string | null;
  slots?: Array<{ startsAt: string; endsAt: string }>;
  reason?: string;
  error?: string;
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
    support_email: string | null;
    footer_tagline: string | null;
    footer_note: string | null;
    instagram_url: string | null;
    facebook_url: string | null;
    tiktok_url: string | null;
    storefront_copy_json?: Record<string, unknown> | null;
    checkout_enable_local_pickup?: boolean | null;
    checkout_local_pickup_label?: string | null;
    checkout_local_pickup_fee_cents?: number | null;
    checkout_enable_flat_rate_shipping?: boolean | null;
    checkout_flat_rate_shipping_label?: string | null;
    checkout_flat_rate_shipping_fee_cents?: number | null;
    checkout_allow_order_note?: boolean | null;
    checkout_order_note_prompt?: string | null;
  } | null;
  products: StorefrontProduct[];
  studio?: {
    enabled: boolean;
    onTitleChange?: (value: string) => void;
    onSubtitleChange?: (value: string) => void;
    onEmptyMessageChange?: (value: string) => void;
    onCheckoutLabelChange?: (value: string) => void;
    onOrderNotePromptChange?: (value: string) => void;
  };
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

export function StorefrontCartPage({ store, viewer, branding, settings, products, studio }: Props) {
  const runtime = useOptionalStorefrontRuntime();
  const analytics = useOptionalStorefrontAnalytics();
  const resolvedStore = runtime?.store ?? store;
  const resolvedViewer = runtime?.viewer ?? viewer;
  const resolvedBranding = runtime?.branding ?? branding;
  const resolvedProducts = runtime?.products ?? products;
  const resolvedPresentation = runtime ? resolveStorefrontPresentation(runtime) : null;
  const resolvedSettings = resolvedPresentation?.settings ?? settings;
  const resolvedPrivacyProfile = runtime?.privacyProfile ?? null;
  const themeConfig = resolvedPresentation?.themeConfig ?? resolveStorefrontThemeConfig(resolvedBranding?.theme_json ?? {});
  const copy = resolvedPresentation?.copy ?? resolveStorefrontCopy(resolvedSettings?.storefront_copy_json ?? {});
  const headerNavLinks = resolveHeaderNavLinks(themeConfig, copy, resolvedStore.slug);
  const footerNavLinks = resolveFooterNavLinks(themeConfig, copy, resolvedStore.slug);
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
  const checkoutEnableLocalPickup = resolvedSettings?.checkout_enable_local_pickup ?? false;
  const checkoutLocalPickupLabel = resolvedSettings?.checkout_local_pickup_label ?? null;
  const checkoutLocalPickupFeeCents = resolvedSettings?.checkout_local_pickup_fee_cents ?? 0;
  const checkoutEnableFlatRateShipping = resolvedSettings?.checkout_enable_flat_rate_shipping ?? true;
  const checkoutFlatRateShippingLabel = resolvedSettings?.checkout_flat_rate_shipping_label ?? null;
  const checkoutFlatRateShippingFeeCents = resolvedSettings?.checkout_flat_rate_shipping_fee_cents ?? 0;

  const fulfillmentOptions = (() => {
    const options: Array<{ method: "pickup" | "shipping"; label: string; feeCents: number }> = [];
    if (checkoutEnableLocalPickup) {
      options.push({
        method: "pickup",
        label: checkoutLocalPickupLabel?.trim() || "Local pickup",
        feeCents: Math.max(0, checkoutLocalPickupFeeCents)
      });
    }
    if (checkoutEnableFlatRateShipping) {
      options.push({
        method: "shipping",
        label: checkoutFlatRateShippingLabel?.trim() || "Shipping",
        feeCents: Math.max(0, checkoutFlatRateShippingFeeCents)
      });
    }
    if (options.length === 0) {
      options.push({ method: "shipping", label: "Shipping", feeCents: 0 });
    }
    return options;
  })();

  const [cart, setCart] = useState<StorefrontCartEntry[]>([]);
  const hasHydratedCartRef = useRef(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedFulfillmentMethod, setSelectedFulfillmentMethod] = useState<"pickup" | "shipping">(
    fulfillmentOptions[0]?.method ?? "shipping"
  );
  const [orderNote, setOrderNote] = useState("");
  const [pending, setPending] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [appliedDiscountCents, setAppliedDiscountCents] = useState(0);
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [buyerLatitude, setBuyerLatitude] = useState<number | null>(null);
  const [buyerLongitude, setBuyerLongitude] = useState<number | null>(null);
  const [pickupOptions, setPickupOptions] = useState<PickupOptionsResponse["options"]>([]);
  const [pickupSlots, setPickupSlots] = useState<PickupOptionsResponse["slots"]>([]);
  const [pickupSelectionMode, setPickupSelectionMode] = useState<"buyer_select" | "hidden_nearest">("buyer_select");
  const [selectedPickupLocationId, setSelectedPickupLocationId] = useState<string | null>(null);
  const [selectedPickupSlot, setSelectedPickupSlot] = useState<{ startsAt: string; endsAt: string } | null>(null);
  const [pickupStatusMessage, setPickupStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trackedCartViewRef = useRef(false);

  useStorefrontPageView("cart");

  useEffect(() => {
    queueMicrotask(() => {
      const loaded = readStorefrontCart();
      const filtered = loaded.filter((entry) => resolvedProducts.some((product) => product.id === entry.productId));
      hasHydratedCartRef.current = true;
      setCart(filtered);

      void (async () => {
        const response = await fetch(`/api/customer/cart?store=${encodeURIComponent(resolvedStore.slug)}`, { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          guest?: boolean;
          items?: Array<{ productId: string; variantId?: string; quantity: number }>;
        };

        if (!payload.items || payload.items.length === 0) {
          return;
        }

        const sanitized = payload.items
          .map((item) => ({
            productId: item.productId,
            variantId: item.variantId ?? "",
            quantity: Math.max(1, Math.min(99, item.quantity))
          }))
          .filter((item) => item.variantId.length > 0);

        if (sanitized.length === 0) {
          return;
        }

        setCart((current) => {
          if (current.length === 0) {
            return sanitized;
          }

          const currentMap = new Map<string, StorefrontCartEntry>(
            current.map((item) => [`${item.productId}:${item.variantId}`, item] as [string, StorefrontCartEntry])
          );
          const merged = [...current];

          for (const item of sanitized) {
            const key = `${item.productId}:${item.variantId}`;
            if (currentMap.has(key)) {
              continue;
            }
            merged.push(item);
          }

          void syncStorefrontCart(merged, resolvedStore.slug, {
            analyticsSessionId: analytics?.getSessionId() ?? null,
            attribution: analytics?.getAttributionSnapshot() ?? null
          });
          return merged;
        });
      })();
    });
  }, [analytics, resolvedProducts, resolvedStore.slug]);

  useEffect(() => {
    if (!hasHydratedCartRef.current) {
      return;
    }
    const filtered = cart.filter((entry) => resolvedProducts.some((product) => product.id === entry.productId));
    writeStorefrontCart(filtered);

    const timeout = setTimeout(() => {
      void fetch(`/api/customer/cart?store=${encodeURIComponent(resolvedStore.slug)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: filtered.map((entry) => ({
            productId: entry.productId,
            variantId: entry.variantId,
            quantity: entry.quantity
          })),
          analyticsSessionId: analytics?.getSessionId() ?? undefined,
          attribution: analytics?.getAttributionSnapshot() ?? undefined
        })
      });
    }, 250);

    return () => clearTimeout(timeout);
  }, [analytics, cart, resolvedProducts, resolvedStore.slug]);

  useEffect(() => {
    if (selectedFulfillmentMethod !== "pickup" || !resolvedSettings?.checkout_enable_local_pickup) {
      return;
    }

    void (async () => {
      const response = await fetch(`/api/storefront/pickup-options?store=${encodeURIComponent(resolvedStore.slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerLatitude,
          buyerLongitude,
          locationId: selectedPickupLocationId ?? undefined
        })
      });

      const payload = (await response.json()) as PickupOptionsResponse;

      if (!response.ok) {
        setPickupStatusMessage(payload.error ?? "Unable to load pickup options.");
        return;
      }

      setPickupSelectionMode(payload.selectionMode ?? "buyer_select");
      setPickupOptions(payload.options ?? []);
      setPickupSlots(payload.slots ?? []);
      setSelectedPickupLocationId(payload.selectedLocationId ?? null);
      if (!selectedPickupSlot && payload.slots && payload.slots.length > 0) {
        setSelectedPickupSlot(payload.slots[0] ?? null);
      }
      setPickupStatusMessage(payload.reason ?? null);
    })();
  }, [buyerLatitude, buyerLongitude, resolvedSettings?.checkout_enable_local_pickup, resolvedStore.slug, selectedFulfillmentMethod, selectedPickupLocationId, selectedPickupSlot]);

  const cartItems = useMemo(() => {
    return cart
      .map((entry) => {
        const product = resolvedProducts.find((item) => item.id === entry.productId);
        if (!product) return null;
        const variant = getSortedActiveVariants(product).find((item) => item.id === entry.variantId) ?? getDefaultVariant(product);
        if (!variant) return null;
        return { ...entry, product, variant };
      })
      .filter(
        (item): item is { productId: string; variantId: string; quantity: number; product: StorefrontProduct; variant: StorefrontVariant } =>
          item !== null
      );
  }, [cart, resolvedProducts]);

  const subtotalCents = cartItems.reduce((sum, item) => sum + item.variant.price_cents * item.quantity, 0);
  const selectedFulfillment =
    fulfillmentOptions.find((option) => option.method === selectedFulfillmentMethod) ?? fulfillmentOptions[0]!;
  const shippingFeeCents = selectedFulfillment?.feeCents ?? 0;
  const discountedSubtotalCents = Math.max(0, subtotalCents - appliedDiscountCents);
  const checkoutTotalCents = discountedSubtotalCents + shippingFeeCents;

  useEffect(() => {
    if (!analytics || !hasHydratedCartRef.current || trackedCartViewRef.current) {
      return;
    }

    analytics.track({
      eventType: "cart_view",
      value: buildStorefrontCartAnalyticsValue({
        items: cartItems.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPriceCents: item.variant.price_cents
        })),
        fulfillmentMethod: selectedFulfillment.method,
        discountCents: appliedDiscountCents,
        shippingCents: shippingFeeCents
      })
    });
    trackedCartViewRef.current = true;
  }, [analytics, appliedDiscountCents, cartItems, selectedFulfillment.method, shippingFeeCents]);

  function updateQuantity(productId: string, variantId: string, quantity: number) {
    if (quantity <= 0) {
      setCart((current) => current.filter((item) => !(item.productId === productId && item.variantId === variantId)));
      return;
    }

    setCart((current) =>
      current.map((item) =>
        item.productId === productId && item.variantId === variantId ? { ...item, quantity: Math.min(99, Math.max(1, quantity)) } : item
      )
    );
  }

  async function applyPromoPreview() {
    if (!promoCode.trim()) {
      setAppliedDiscountCents(0);
      setAppliedPromoCode(null);
      return;
    }

    setApplyingPromo(true);
    setError(null);

    const response = await fetch(`/api/promotions/preview?store=${encodeURIComponent(resolvedStore.slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        promoCode: promoCode.trim(),
        subtotalCents
      })
    });

    const payload = (await response.json()) as PromoPreviewResponse;
    setApplyingPromo(false);

    if (!response.ok || payload.discountCents === undefined) {
      setAppliedDiscountCents(0);
      setAppliedPromoCode(null);
      setError(payload.error ?? copy.cart.applyPromoError);
      return;
    }

    setAppliedPromoCode(payload.promoCode ?? promoCode.trim().toUpperCase());
    setAppliedDiscountCents(payload.discountCents);
  }

  async function checkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cartItems.length === 0) {
      setError(copy.cart.addAtLeastOneToCartError);
      return;
    }

    if (selectedFulfillment.method === "pickup") {
      if (!selectedPickupLocationId) {
        setError("Select a pickup location before checkout.");
        return;
      }
      if (pickupSlots && pickupSlots.length > 0 && !selectedPickupSlot) {
        setError("Select a pickup time before checkout.");
        return;
      }
    }

    setPending(true);
    setError(null);

    const response = await fetch(`/api/orders/checkout?store=${encodeURIComponent(resolvedStore.slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        phone: phone.trim() || undefined,
        email,
        buyerLatitude: buyerLatitude ?? undefined,
        buyerLongitude: buyerLongitude ?? undefined,
        fulfillmentMethod: selectedFulfillment.method,
        pickupLocationId: selectedPickupLocationId ?? undefined,
        pickupWindowStartAt: selectedPickupSlot?.startsAt,
        pickupWindowEndAt: selectedPickupSlot?.endsAt,
        customerNote: resolvedSettings?.checkout_allow_order_note ? orderNote.trim() || undefined : undefined,
        promoCode: promoCode.trim() || undefined,
        analyticsSessionId: analytics?.getSessionId() ?? undefined,
        attribution: analytics?.getAttributionSnapshot() ?? undefined,
        items: cartItems.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity }))
      })
    });

    const payload = (await response.json()) as CheckoutResponse;
    setPending(false);

    if (response.ok && payload.mode === "checkout" && payload.checkoutUrl) {
      analytics?.track({
        eventType: "checkout_started",
        value: buildStorefrontCartAnalyticsValue({
          items: cartItems.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPriceCents: item.variant.price_cents
          })),
          fulfillmentMethod: selectedFulfillment.method,
          discountCents: appliedDiscountCents,
          shippingCents: shippingFeeCents
        })
      });
      void analytics?.flush({ immediate: true, keepalive: true });
      window.location.assign(payload.checkoutUrl);
      return;
    }

    if (response.ok && payload.orderId && payload.paymentMode === "stub") {
      analytics?.track({
        eventType: "checkout_started",
        orderId: payload.orderId,
        value: buildStorefrontCartAnalyticsValue({
          items: cartItems.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPriceCents: item.variant.price_cents
          })),
          fulfillmentMethod: selectedFulfillment.method,
          discountCents: appliedDiscountCents,
          shippingCents: shippingFeeCents
        })
      });
      void analytics?.flush({ immediate: true, keepalive: true });
      writeStorefrontCart([]);
      setCart([]);
      void syncStorefrontCart([], resolvedStore.slug, {
        analyticsSessionId: analytics?.getSessionId() ?? null,
        attribution: analytics?.getAttributionSnapshot() ?? null
      });
      window.location.assign(
        `/checkout?status=success&orderId=${encodeURIComponent(payload.orderId)}&store=${encodeURIComponent(resolvedStore.slug)}`
      );
      return;
    }

    setError(payload.error ?? copy.cart.checkoutFailed);
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
        className={cn("mx-auto w-full space-y-6 px-4 py-7 focus:outline-none sm:px-6 sm:py-9 lg:py-10", getStorefrontPageWidthClass(themeConfig.pageWidth))}
      >
        <div className="space-y-1">
          {studio?.enabled ? (
            <StorefrontStudioEditableText
              as="h1"
              value={copy.cart.title}
              onChange={(value) => studio.onTitleChange?.(value)}
              placeholder="Cart title"
              displayClassName="text-4xl font-semibold leading-tight [font-family:var(--storefront-font-heading)]"
            />
          ) : (
            <h1 className="text-4xl font-semibold leading-tight [font-family:var(--storefront-font-heading)]">{copy.cart.title}</h1>
          )}
          {studio?.enabled ? (
            <StorefrontStudioEditableText
              as="p"
              multiline
              value={copy.cart.subtitle}
              onChange={(value) => studio.onSubtitleChange?.(value)}
              placeholder="Cart subtitle"
              displayClassName="text-sm text-muted-foreground"
            />
          ) : (
            <p className="text-sm text-muted-foreground">{copy.cart.subtitle}</p>
          )}
        </div>

        {cartItems.length === 0 ? (
          <div className="space-y-3">
            {studio?.enabled ? (
              <StorefrontStudioEditableText
                as="p"
                value={copy.cart.empty}
                onChange={(value) => studio.onEmptyMessageChange?.(value)}
                placeholder="Empty cart message"
                displayClassName="text-sm text-muted-foreground"
              />
            ) : (
              <p className="text-sm text-muted-foreground">{copy.cart.empty}</p>
            )}
            <Link href={`/products?store=${encodeURIComponent(resolvedStore.slug)}`} className={cn(STOREFRONT_TEXT_LINK_EFFECT_CLASS, "text-sm font-medium")}>
              {copy.cart.browseProducts}
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(21rem,0.88fr)] xl:items-start">
            <section className="space-y-4 sm:space-y-5">
              <ul className="space-y-3 sm:space-y-4">
                {cartItems.map((item) => (
                  <li
                    key={`${item.productId}:${item.variantId}`}
                    className={cn("space-y-4 p-4 sm:p-5", radiusClass, cardClass, isIntegrated ? "border border-border/50 bg-[color:var(--storefront-surface)]/70 shadow-sm" : "")}
                  >
                    <div className="flex items-start gap-4">
                      <Link
                        href={`/products/${item.product.slug}?store=${encodeURIComponent(resolvedStore.slug)}`}
                        className={cn("relative block h-20 w-20 shrink-0 overflow-hidden border border-border/50 bg-muted/10 sm:h-24 sm:w-24", radiusClass)}
                      >
                        {item.product.image_urls?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.product.image_urls[0]}
                            alt={item.product.image_alt_text?.trim() || item.product.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-muted-foreground">
                            {item.product.title}
                          </div>
                        )}
                      </Link>
                      <div className="min-w-0 flex-1 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <Link
                              href={`/products/${item.product.slug}?store=${encodeURIComponent(resolvedStore.slug)}`}
                              className="block text-base font-medium underline-offset-4 hover:underline"
                            >
                              {item.product.title}
                            </Link>
                            <p className="text-xs text-muted-foreground">{formatVariantLabel(item.variant, "Default")}</p>
                            <p className="text-sm text-muted-foreground">${(item.variant.price_cents / 100).toFixed(2)} each</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.productId, item.variantId, 0)}
                            className="shrink-0 text-xs text-muted-foreground underline-offset-4 hover:underline"
                          >
                            {copy.cart.remove}
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div
                            className={cn(
                              "inline-flex items-center overflow-hidden border border-border/60 bg-[color:var(--storefront-surface)]",
                              buttonRadiusClass
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                              className="flex h-10 w-10 items-center justify-center text-lg font-medium text-foreground transition hover:bg-muted/20 disabled:opacity-40"
                              disabled={item.quantity <= 1}
                              aria-label={`Decrease quantity of ${item.product.title}`}
                            >
                              -
                            </button>
                            <Input
                              type="number"
                              min={1}
                              max={99}
                              value={item.quantity}
                              onChange={(event) => updateQuantity(item.productId, item.variantId, Number(event.target.value))}
                              className="h-10 w-14 border-0 border-x border-border/60 px-0 text-center [appearance:textfield] focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              aria-label={`Quantity of ${item.product.title}`}
                            />
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                              className="flex h-10 w-10 items-center justify-center text-lg font-medium text-foreground transition hover:bg-muted/20 disabled:opacity-40"
                              disabled={item.quantity >= 99}
                              aria-label={`Increase quantity of ${item.product.title}`}
                            >
                              +
                            </button>
                          </div>
                          <p className="text-sm font-medium">${((item.variant.price_cents * item.quantity) / 100).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <aside className={cn("space-y-5 p-4 sm:p-5 xl:sticky xl:top-24 xl:h-fit", radiusClass, cardClass, isIntegrated ? "border border-border/60 bg-[color:var(--storefront-surface)] shadow-sm" : "")}>
              <h2 className="text-xl font-semibold [font-family:var(--storefront-font-heading)]">{copy.cart.orderSummary}</h2>
              <div className="space-y-3 border-b border-border/40 pb-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    required
                    placeholder="First name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className="h-10 border-border/60"
                  />
                  <Input
                    required
                    placeholder="Last name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className="h-10 border-border/60"
                  />
                </div>
                <Input
                  type="tel"
                  placeholder="Phone (optional)"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="h-10 border-border/60"
                />
                <Input
                  type="email"
                  required
                  placeholder={copy.cart.emailPlaceholder}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-10 border-border/60"
                />
              </div>

              <div className="space-y-2 border-b border-border/40 pb-4">
                <p className="text-sm font-medium">How do you want to receive your products?*</p>
                <div className="space-y-2">
                  {fulfillmentOptions.map((option) => (
                    <label
                      key={option.method}
                      className={cn("flex cursor-pointer items-center justify-between gap-3 border border-border/60 px-3 py-2.5 text-sm", buttonRadiusClass)}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="fulfillment-method"
                          checked={selectedFulfillment.method === option.method}
                          onChange={() => setSelectedFulfillmentMethod(option.method)}
                        />
                        {option.label}
                      </span>
                      <span className="font-medium">${(option.feeCents / 100).toFixed(2)}</span>
                    </label>
                  ))}
                </div>
              </div>

              {selectedFulfillment.method === "pickup" ? (
                <div className="space-y-2 border-b border-border/40 pb-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!navigator.geolocation) {
                        setPickupStatusMessage("Location services are unavailable in this browser.");
                        return;
                      }

                      navigator.geolocation.getCurrentPosition(
                        (position) => {
                          setBuyerLatitude(position.coords.latitude);
                          setBuyerLongitude(position.coords.longitude);
                          setPickupStatusMessage(null);
                        },
                        () => {
                          setPickupStatusMessage("We couldn't read your location. Try again or choose shipping.");
                        }
                      );
                    }}
                  >
                    Use my location for pickup
                  </Button>

                  {pickupSelectionMode === "buyer_select" && pickupOptions && pickupOptions.length > 0 ? (
                    <div className="space-y-2">
                      {pickupOptions.map((location) => (
                        <label
                          key={location.id}
                          className={cn("flex cursor-pointer items-start justify-between gap-3 border border-border/50 px-3 py-2 text-xs", buttonRadiusClass)}
                        >
                          <span className="space-y-0.5">
                            <span className="block font-medium">{location.name}</span>
                            <span className="block text-muted-foreground">
                              {location.addressLine1}, {location.city}, {location.stateRegion} {location.postalCode}
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="pickup-location"
                              checked={selectedPickupLocationId === location.id}
                              onChange={() => setSelectedPickupLocationId(location.id)}
                            />
                            <span>{location.distanceMiles.toFixed(1)} mi</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : null}

                  {pickupSlots && pickupSlots.length > 0 ? (
                    <select
                      className="h-10 w-full border border-border/60 bg-background px-2 text-sm"
                      value={selectedPickupSlot?.startsAt ?? ""}
                      onChange={(event) => {
                        const slot = pickupSlots.find((entry) => entry.startsAt === event.target.value) ?? null;
                        setSelectedPickupSlot(slot);
                      }}
                    >
                      {pickupSlots.map((slot) => (
                        <option key={slot.startsAt} value={slot.startsAt}>
                          {new Date(slot.startsAt).toLocaleString()} - {new Date(slot.endsAt).toLocaleTimeString()}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  {pickupStatusMessage ? <p className="text-xs text-muted-foreground">{pickupStatusMessage}</p> : null}
                </div>
              ) : null}

              {resolvedSettings?.checkout_allow_order_note ? (
                <div className="space-y-2 border-b border-border/40 pb-4">
                  {studio?.enabled ? (
                    <StorefrontStudioEditableText
                      value={
                        resolvedSettings.checkout_order_note_prompt?.trim() ||
                        "If you have any questions, comments, or concerns about your order, leave a note below."
                      }
                      placeholder="Add any special requests for your order."
                      multiline
                      wrapperClassName="w-full max-w-none"
                      displayClassName="text-sm text-muted-foreground"
                      editorClassName="w-full max-w-none"
                      onChange={(value) => studio.onOrderNotePromptChange?.(value)}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {resolvedSettings.checkout_order_note_prompt?.trim() ||
                        "If you have any questions, comments, or concerns about your order, leave a note below."}
                    </p>
                  )}
                  <Textarea
                    value={orderNote}
                    onChange={(event) => setOrderNote(event.target.value)}
                    placeholder="Add a note (optional)"
                    rows={3}
                    className="border-border/60"
                  />
                </div>
              ) : null}

              <div className="space-y-2 border-b border-border/40 pb-4 text-sm">
                <div className="flex items-center justify-between">
                  <span>{copy.cart.subtotalLabel}</span>
                  <span>${(subtotalCents / 100).toFixed(2)}</span>
                </div>
                {appliedDiscountCents > 0 ? (
                  <div className="flex items-center justify-between text-emerald-700">
                    <span>
                      {copy.cart.discountLabel}
                      {appliedPromoCode ? ` (${appliedPromoCode})` : ""}
                    </span>
                    <span>-${(appliedDiscountCents / 100).toFixed(2)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span>{selectedFulfillment.label}</span>
                  <span>${(shippingFeeCents / 100).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between pt-1 text-base font-semibold">
                  <span>{copy.cart.estimatedTotalLabel}</span>
                  <span>${(checkoutTotalCents / 100).toFixed(2)}</span>
                </div>
              </div>

              <form onSubmit={checkout} className="space-y-2">
                <StorefrontPrivacyCollectionNotice
                  surface="checkout"
                  store={resolvedStore}
                  profile={resolvedPrivacyProfile}
                />
                <Input
                  type="text"
                  placeholder={copy.cart.promoPlaceholder}
                  value={promoCode}
                  onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
                  className="h-10 border-border/60"
                />
                <Button type="button" variant="outline" className={cn("w-full", buttonRadiusClass)} onClick={() => void applyPromoPreview()} disabled={applyingPromo || !promoCode.trim()}>
                  {applyingPromo ? copy.cart.applyingPromo : copy.cart.applyPromo}
                </Button>
                <div className="relative">
                  <Button type="submit" disabled={pending || cartItems.length === 0} className={cn("h-11 w-full bg-[var(--storefront-accent)] text-[color:var(--storefront-accent-foreground)] hover:opacity-90", buttonRadiusClass)}>
                    {pending ? copy.cart.processing : copy.cart.checkout}
                  </Button>
                  {studio?.enabled && !pending ? (
                    <StorefrontStudioEditableButtonLabel
                      label={copy.cart.checkout}
                      placeholder="Checkout"
                      allowPointerThrough
                      wrapperClassName="absolute inset-0 flex items-center justify-center"
                      labelClassName="inline-flex items-center justify-center text-sm font-medium text-[color:var(--storefront-accent-foreground)]"
                      panelClassName="left-1/2 top-[calc(100%+0.5rem)] -translate-x-1/2"
                      onChange={(value) => studio.onCheckoutLabelChange?.(value)}
                    />
                  ) : null}
                </div>
                <AppAlert variant="error" compact message={error} />
              </form>
              <Link href={`/products?store=${encodeURIComponent(resolvedStore.slug)}`} className={cn(STOREFRONT_TEXT_LINK_EFFECT_CLASS, "mx-auto text-sm font-medium")}>
                {copy.cart.continueShopping}
              </Link>
            </aside>
          </div>
        )}

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
      </main>
    </div>
  );
}
