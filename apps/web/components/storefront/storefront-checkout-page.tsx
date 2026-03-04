"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { buildStorefrontThemeStyle, resolveStorefrontThemeConfig } from "@/lib/theme/storefront-theme";
import { formatCopyTemplate, resolveStorefrontCopy } from "@/lib/storefront/copy";
import { STOREFRONT_TEXT_LINK_EFFECT_CLASS } from "@/lib/storefront/link-effects";
import { resolveFooterNavLinks, resolveHeaderNavLinks } from "@/lib/storefront/navigation";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { StorefrontCartButton } from "@/components/storefront/storefront-cart-button";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";

type CheckoutStatusResponse = {
  status?: "pending" | "completed" | "failed";
  orderId?: string | null;
  error?: string;
};

type Props = {
  store: {
    id: string;
    name: string;
    slug: string;
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
  } | null;
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

export function StorefrontCheckoutPage({ store, branding, settings }: Props) {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const sessionId = searchParams.get("session_id");

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

  const [message, setMessage] = useState(
    status === "cancelled"
      ? copy.checkout.cancelled
      : status === "success"
        ? copy.checkout.preparingStatus
        : copy.checkout.returnToCartPrompt
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "success" || !sessionId) {
      return;
    }
    const safeSessionId = sessionId;

    let cancelled = false;

    async function poll() {
      setMessage(copy.checkout.paymentReceivedFinalizing);
      setError(null);

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const response = await fetch(
          `/api/orders/checkout-status?sessionId=${encodeURIComponent(safeSessionId)}&store=${encodeURIComponent(store.slug)}`,
          { cache: "no-store" }
        );
        const payload = (await response.json()) as CheckoutStatusResponse;
        if (cancelled) return;

        if (response.ok && payload.status === "completed" && payload.orderId) {
          setMessage(formatCopyTemplate(copy.checkout.orderPlacedTemplate, { orderId: payload.orderId }));
          return;
        }

        if (payload.status === "failed") {
          setError(payload.error ?? copy.checkout.finalizationFailed);
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [copy.checkout.finalizationFailed, copy.checkout.orderPlacedTemplate, copy.checkout.paymentReceivedFinalizing, sessionId, status, store.slug]);

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

      <main className={`mx-auto w-full ${pageWidthClasses[themeConfig.pageWidth]} space-y-4 px-6 py-10`}>
        <h1 className="text-3xl font-semibold [font-family:var(--storefront-font-heading)]">{copy.checkout.title}</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex gap-4 text-sm">
          <Link href={`/cart?store=${encodeURIComponent(store.slug)}`} className={`font-medium ${STOREFRONT_TEXT_LINK_EFFECT_CLASS}`}>
            {copy.checkout.backToCart}
          </Link>
          <Link href={`/products?store=${encodeURIComponent(store.slug)}`} className={`font-medium ${STOREFRONT_TEXT_LINK_EFFECT_CLASS}`}>
            {copy.checkout.continueShopping}
          </Link>
        </div>

        <StorefrontFooter
          storeName={store.name}
          storeSlug={store.slug}
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
