"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildStorefrontThemeStyle, resolveStorefrontThemeConfig } from "@/lib/theme/storefront-theme";
import { formatVariantLabel } from "@/lib/products/variants";
import { readStorefrontCart, writeStorefrontCart, type StorefrontCartEntry } from "@/lib/storefront/cart";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { StorefrontCartButton } from "@/components/storefront/storefront-cart-button";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";
import { cn } from "@/lib/utils";
import { resolveStorefrontCopy } from "@/lib/storefront/copy";
import { STOREFRONT_TEXT_LINK_EFFECT_CLASS } from "@/lib/storefront/link-effects";
import { resolveFooterNavLinks, resolveHeaderNavLinks } from "@/lib/storefront/navigation";

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

export function StorefrontCartPage({ store, viewer, branding, settings, products }: Props) {
  const themeConfig = resolveStorefrontThemeConfig(branding?.theme_json ?? {});
  const copy = resolveStorefrontCopy(settings?.storefront_copy_json ?? {});
  const headerNavLinks = resolveHeaderNavLinks(themeConfig, copy, store.slug);
  const footerNavLinks = resolveFooterNavLinks(themeConfig, copy, store.slug);
  const buttonRadiusClass = buttonRadiusClasses[themeConfig.radiusScale];
  const storefrontThemeStyle = buildStorefrontThemeStyle({
    primaryColor: branding?.primary_color,
    accentColor: branding?.accent_color,
    themeConfig
  });

  const fulfillmentOptions = useMemo(() => {
    const options: Array<{ method: "pickup" | "shipping"; label: string; feeCents: number }> = [];
    if (settings?.checkout_enable_local_pickup) {
      options.push({
        method: "pickup",
        label: settings.checkout_local_pickup_label?.trim() || "Local pickup",
        feeCents: Math.max(0, settings.checkout_local_pickup_fee_cents ?? 0)
      });
    }
    if (settings?.checkout_enable_flat_rate_shipping ?? true) {
      options.push({
        method: "shipping",
        label: settings?.checkout_flat_rate_shipping_label?.trim() || "Shipping",
        feeCents: Math.max(0, settings?.checkout_flat_rate_shipping_fee_cents ?? 0)
      });
    }
    if (options.length === 0) {
      options.push({ method: "shipping", label: "Shipping", feeCents: 0 });
    }
    return options;
  }, [settings]);

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

  useEffect(() => {
    queueMicrotask(() => {
      const loaded = readStorefrontCart();
      const filtered = loaded.filter((entry) => products.some((product) => product.id === entry.productId));
      hasHydratedCartRef.current = true;
      setCart(filtered);

      void (async () => {
        const response = await fetch(`/api/customer/cart?store=${encodeURIComponent(store.slug)}`, { cache: "no-store" });
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

        setCart(sanitized);
      })();
    });
  }, [products, store.slug]);

  useEffect(() => {
    if (!hasHydratedCartRef.current) {
      return;
    }
    const filtered = cart.filter((entry) => products.some((product) => product.id === entry.productId));
    writeStorefrontCart(filtered);

    const timeout = setTimeout(() => {
      void fetch(`/api/customer/cart?store=${encodeURIComponent(store.slug)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: filtered.map((entry) => ({
            productId: entry.productId,
            variantId: entry.variantId,
            quantity: entry.quantity
          }))
        })
      });
    }, 250);

    return () => clearTimeout(timeout);
  }, [cart, products, store.slug]);

  useEffect(() => {
    if (selectedFulfillmentMethod !== "pickup" || !settings?.checkout_enable_local_pickup) {
      return;
    }

    void (async () => {
      const response = await fetch(`/api/storefront/pickup-options?store=${encodeURIComponent(store.slug)}`, {
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
  }, [buyerLatitude, buyerLongitude, selectedFulfillmentMethod, selectedPickupLocationId, selectedPickupSlot, settings?.checkout_enable_local_pickup, store.slug]);

  const cartItems = useMemo(() => {
    return cart
      .map((entry) => {
        const product = products.find((item) => item.id === entry.productId);
        if (!product) return null;
        const variant = getSortedActiveVariants(product).find((item) => item.id === entry.variantId) ?? getDefaultVariant(product);
        if (!variant) return null;
        return { ...entry, product, variant };
      })
      .filter(
        (item): item is { productId: string; variantId: string; quantity: number; product: StorefrontProduct; variant: StorefrontVariant } =>
          item !== null
      );
  }, [cart, products]);

  const subtotalCents = cartItems.reduce((sum, item) => sum + item.variant.price_cents * item.quantity, 0);
  const selectedFulfillment =
    fulfillmentOptions.find((option) => option.method === selectedFulfillmentMethod) ?? fulfillmentOptions[0]!;
  const shippingFeeCents = selectedFulfillment?.feeCents ?? 0;
  const discountedSubtotalCents = Math.max(0, subtotalCents - appliedDiscountCents);
  const checkoutTotalCents = discountedSubtotalCents + shippingFeeCents;

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

    const response = await fetch(`/api/promotions/preview?store=${encodeURIComponent(store.slug)}`, {
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

    const response = await fetch(`/api/orders/checkout?store=${encodeURIComponent(store.slug)}`, {
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
        customerNote: settings?.checkout_allow_order_note ? orderNote.trim() || undefined : undefined,
        promoCode: promoCode.trim() || undefined,
        items: cartItems.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity }))
      })
    });

    const payload = (await response.json()) as CheckoutResponse;
    setPending(false);

    if (response.ok && payload.mode === "checkout" && payload.checkoutUrl) {
      window.location.assign(payload.checkoutUrl);
      return;
    }

    setError(payload.error ?? copy.cart.checkoutFailed);
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

      <main className={cn("mx-auto w-full space-y-6 px-6 py-10", pageWidthClasses[themeConfig.pageWidth])}>
        <div className="space-y-1">
          <h1 className="text-4xl font-semibold leading-tight [font-family:var(--storefront-font-heading)]">{copy.cart.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.cart.subtitle}</p>
        </div>

        {cartItems.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{copy.cart.empty}</p>
            <Link href={`/products?store=${encodeURIComponent(store.slug)}`} className={cn(STOREFRONT_TEXT_LINK_EFFECT_CLASS, "text-sm font-medium")}>
              {copy.cart.browseProducts}
            </Link>
          </div>
        ) : (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
            <section className="space-y-4">
              <ul className="space-y-4">
                {cartItems.map((item) => (
                  <li key={`${item.productId}:${item.variantId}`} className="space-y-3 border-b border-border/50 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-base font-medium">{item.product.title}</p>
                        <p className="text-xs text-muted-foreground">{formatVariantLabel(item.variant, "Default")}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.variantId, 0)}
                        className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                      >
                        {copy.cart.remove}
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        value={item.quantity}
                        onChange={(event) => updateQuantity(item.productId, item.variantId, Number(event.target.value))}
                        className="h-9 w-24 border-border/60"
                      />
                      <p className="text-sm font-medium">${((item.variant.price_cents * item.quantity) / 100).toFixed(2)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <aside className="space-y-5 border border-border/60 bg-[color:var(--storefront-surface)] p-5 lg:sticky lg:top-24 lg:h-fit">
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
                    <label key={option.method} className="flex cursor-pointer items-center justify-between gap-3 border border-border/60 px-3 py-2 text-sm">
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
                        <label key={location.id} className="flex cursor-pointer items-start justify-between gap-3 border border-border/50 px-3 py-2 text-xs">
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

              {settings?.checkout_allow_order_note ? (
                <div className="space-y-2 border-b border-border/40 pb-4">
                  <p className="text-sm text-muted-foreground">
                    {settings.checkout_order_note_prompt?.trim() ||
                      "If you have any questions, comments, or concerns about your order, leave a note below."}
                  </p>
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
                <Button type="submit" disabled={pending || cartItems.length === 0} className={cn("h-11 w-full bg-[var(--storefront-accent)] text-[color:var(--storefront-accent-foreground)] hover:opacity-90", buttonRadiusClass)}>
                  {pending ? copy.cart.processing : copy.cart.checkout}
                </Button>
                <AppAlert variant="error" compact message={error} />
              </form>
              <Link href="/products" className={cn(STOREFRONT_TEXT_LINK_EFFECT_CLASS, "mx-auto text-sm font-medium")}>
                {copy.cart.continueShopping}
              </Link>
            </aside>
          </div>
        )}

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
      </main>
    </div>
  );
}
