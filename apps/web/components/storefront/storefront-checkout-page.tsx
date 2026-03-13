"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { StorefrontStudioCheckoutPreviewStatePicker, type StorefrontStudioCheckoutPreviewState } from "@/components/storefront/storefront-studio-checkout-preview-state-picker";
import { StorefrontStudioEditableText } from "@/components/storefront/storefront-studio-editable-text";
import { AppAlert } from "@/components/ui/app-alert";
import { buildStorefrontThemeStyle, resolveStorefrontThemeConfig } from "@/lib/theme/storefront-theme";
import { getStorefrontButtonRadiusClass, getStorefrontCardStyleClass, getStorefrontRadiusClass } from "@/lib/storefront/appearance";
import { formatCopyTemplate, resolveStorefrontCopy } from "@/lib/storefront/copy";
import { getStorefrontPageWidthClass } from "@/lib/storefront/layout";
import { STOREFRONT_TEXT_LINK_EFFECT_CLASS } from "@/lib/storefront/link-effects";
import { resolveFooterNavLinks, resolveHeaderNavLinks } from "@/lib/storefront/navigation";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { StorefrontCartButton } from "@/components/storefront/storefront-cart-button";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";
import { MAIN_CONTENT_ID } from "@/lib/accessibility";
import { useOptionalStorefrontRuntime } from "@/components/storefront/storefront-runtime-provider";
import { useOptionalStorefrontAnalytics } from "@/components/storefront/storefront-analytics-provider";
import { useStorefrontPageView } from "@/components/storefront/use-storefront-analytics-events";
import { markStorefrontCheckoutCompletedTracked } from "@/lib/analytics/storefront-instrumentation";
import { resolveStorefrontPresentation } from "@/lib/storefront/presentation";
import { cn } from "@/lib/utils";

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
  } | null;
  studio?: {
    enabled: boolean;
    inlineValues?: Partial<Record<"title" | "cancelled" | "orderPlacedTemplate" | "finalizationFailed", string>>;
    onInlineChange?: (field: "title" | "cancelled" | "orderPlacedTemplate" | "finalizationFailed", value: string) => void;
  };
};

export function StorefrontCheckoutPage({ store, viewer, branding, settings, studio }: Props) {
  const runtime = useOptionalStorefrontRuntime();
  const analytics = useOptionalStorefrontAnalytics();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const sessionId = searchParams.get("session_id");
  const orderId = searchParams.get("orderId");

  const resolvedStore = runtime?.store ?? store;
  const resolvedViewer = runtime?.viewer ?? viewer;
  const resolvedBranding = runtime?.branding ?? branding;
  const resolvedPresentation = runtime ? resolveStorefrontPresentation(runtime) : null;
  const resolvedSettings = resolvedPresentation?.settings ?? settings;
  const themeConfig = resolvedPresentation?.themeConfig ?? resolveStorefrontThemeConfig(resolvedBranding?.theme_json ?? {});
  const copy = resolvedPresentation?.copy ?? resolveStorefrontCopy(resolvedSettings?.storefront_copy_json ?? {});
  const headerNavLinks = resolveHeaderNavLinks(themeConfig, copy, resolvedStore.slug);
  const footerNavLinks = resolveFooterNavLinks(themeConfig, copy, resolvedStore.slug);
  const radiusClass = getStorefrontRadiusClass(themeConfig.radiusScale);
  const buttonRadiusClass = getStorefrontButtonRadiusClass(themeConfig.radiusScale);
  const cardClass = getStorefrontCardStyleClass(themeConfig.cardStyle);
  const isIntegrated = themeConfig.cardStyle === "integrated";
  const studioEnabled = studio?.enabled ?? runtime?.mode === "studio";
  const storefrontThemeStyle = buildStorefrontThemeStyle({
    primaryColor: resolvedBranding?.primary_color,
    accentColor: resolvedBranding?.accent_color,
    themeConfig
  });
  const [studioPreviewState, setStudioPreviewState] = useState<StorefrontStudioCheckoutPreviewState>("return");
  const checkoutTitle = studio?.inlineValues?.title ?? copy.checkout.title;
  const cancelledMessage = studio?.inlineValues?.cancelled ?? copy.checkout.cancelled;
  const orderPlacedTemplate = studio?.inlineValues?.orderPlacedTemplate ?? copy.checkout.orderPlacedTemplate;
  const finalizationFailedMessage = studio?.inlineValues?.finalizationFailed ?? copy.checkout.finalizationFailed;
  const checkoutPaymentReceivedFinalizing = copy.checkout.paymentReceivedFinalizing;
  const checkoutPreparingStatus = copy.checkout.preparingStatus;
  const checkoutReturnToCartPrompt = copy.checkout.returnToCartPrompt;

  const [message, setMessage] = useState(
    status === "cancelled"
      ? cancelledMessage
      : status === "success"
        ? orderId && !sessionId
          ? formatCopyTemplate(orderPlacedTemplate, { orderId })
          : copy.checkout.preparingStatus
        : copy.checkout.returnToCartPrompt
  );
  const [error, setError] = useState<string | null>(null);

  useStorefrontPageView("checkout", {
    status: status ?? "return",
    hasSessionId: Boolean(sessionId),
    hasOrderId: Boolean(orderId)
  });

  useEffect(() => {
    if (studioEnabled || status !== "success" || !sessionId) {
      return;
    }
    const safeSessionId = sessionId;

    let cancelled = false;

    async function poll() {
      setMessage(checkoutPaymentReceivedFinalizing);
      setError(null);

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const response = await fetch(
          `/api/orders/checkout-status?sessionId=${encodeURIComponent(safeSessionId)}&store=${encodeURIComponent(resolvedStore.slug)}`,
          { cache: "no-store" }
        );
        const payload = (await response.json()) as CheckoutStatusResponse;
        if (cancelled) return;

        if (response.ok && payload.status === "completed" && payload.orderId) {
          if (markStorefrontCheckoutCompletedTracked(payload.orderId)) {
            analytics?.track({
              eventType: "checkout_completed",
              orderId: payload.orderId,
              value: {
                status: "completed",
                source: "checkout_status_poll"
              }
            });
          }
          setMessage(formatCopyTemplate(orderPlacedTemplate, { orderId: payload.orderId }));
          return;
        }

        if (payload.status === "failed") {
          setError(payload.error ?? finalizationFailedMessage);
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [analytics, checkoutPaymentReceivedFinalizing, finalizationFailedMessage, orderPlacedTemplate, resolvedStore.slug, sessionId, status, studioEnabled]);

  useEffect(() => {
    if (studioEnabled || status !== "success" || !orderId) {
      return;
    }

    if (!markStorefrontCheckoutCompletedTracked(orderId)) {
      return;
    }

    analytics?.track({
      eventType: "checkout_completed",
      orderId,
      value: {
        status: "completed",
        source: sessionId ? "checkout_return" : "stub_checkout_return"
      }
    });
  }, [analytics, orderId, sessionId, status, studioEnabled]);

  const previewMessage = (() => {
    if (!studioEnabled) {
      return message;
    }

    switch (studioPreviewState) {
      case "cancelled":
        return cancelledMessage;
      case "preparing":
        return checkoutPreparingStatus;
      case "placed":
        return formatCopyTemplate(orderPlacedTemplate, { orderId: "1042" });
      case "failed":
        return checkoutPaymentReceivedFinalizing;
      case "return":
      default:
        return checkoutReturnToCartPrompt;
    }
  })();

  const previewError = studioEnabled && studioPreviewState === "failed" ? finalizationFailedMessage : error;

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
        className={`mx-auto w-full ${getStorefrontPageWidthClass(themeConfig.pageWidth)} space-y-6 px-4 py-7 focus:outline-none sm:px-6 sm:py-9 lg:py-10`}
      >
        <div className={cn("mx-auto max-w-3xl space-y-5 p-4 sm:space-y-6 sm:p-6", radiusClass, cardClass, isIntegrated ? "border border-border/60 bg-[color:var(--storefront-surface)]/70 shadow-sm" : "")}>
          {studioEnabled ? (
            <StorefrontStudioCheckoutPreviewStatePicker
              value={studioPreviewState}
              onValueChange={setStudioPreviewState}
              className="mb-1 max-w-fit"
            />
          ) : null}
          {studioEnabled ? (
            <StorefrontStudioEditableText
              as="h1"
              value={checkoutTitle}
              placeholder="Checkout page title"
              displayClassName="text-3xl font-semibold [font-family:var(--storefront-font-heading)]"
              wrapperClassName="max-w-full"
              editorClassName="w-[min(100%,28rem)]"
              onChange={(value) => studio?.onInlineChange?.("title", value)}
            />
          ) : (
            <h1 className="text-3xl font-semibold [font-family:var(--storefront-font-heading)]">{checkoutTitle}</h1>
          )}
          {studioEnabled ? (
            <StorefrontStudioEditableText
              as="p"
              multiline={studioPreviewState === "failed"}
              value={
                studioPreviewState === "cancelled"
                  ? cancelledMessage
                  : studioPreviewState === "placed"
                    ? orderPlacedTemplate
                    : studioPreviewState === "failed"
                      ? finalizationFailedMessage
                      : previewMessage
              }
              placeholder="Order summary message"
              displayClassName={studioPreviewState === "failed" ? "hidden" : "text-sm leading-6 text-muted-foreground"}
              wrapperClassName={studioPreviewState === "failed" ? "hidden" : "max-w-full"}
              editorClassName="w-[min(100%,32rem)]"
              onChange={(value) => {
                if (studioPreviewState === "cancelled") {
                  studio?.onInlineChange?.("cancelled", value);
                  return;
                }
                if (studioPreviewState === "placed") {
                  studio?.onInlineChange?.("orderPlacedTemplate", value);
                }
              }}
            />
          ) : (
            <p suppressHydrationWarning className="text-sm leading-6 text-muted-foreground">
              {previewMessage}
            </p>
          )}
          {studioEnabled && studioPreviewState === "failed" ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-red-700">
              <StorefrontStudioEditableText
                as="p"
                multiline
                value={finalizationFailedMessage}
                placeholder="Finalization failed message"
                displayClassName="text-sm"
                wrapperClassName="max-w-full"
                editorClassName="w-[min(100%,32rem)] bg-white"
                onChange={(value) => studio?.onInlineChange?.("finalizationFailed", value)}
              />
            </div>
          ) : (
            <AppAlert variant="error" message={previewError} />
          )}
          <div className="flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <Link href={`/cart?store=${encodeURIComponent(resolvedStore.slug)}`} className={`font-medium ${STOREFRONT_TEXT_LINK_EFFECT_CLASS}`}>
              {copy.checkout.backToCart}
            </Link>
            <Link href={`/products?store=${encodeURIComponent(resolvedStore.slug)}`} className={`font-medium ${STOREFRONT_TEXT_LINK_EFFECT_CLASS}`}>
              {copy.checkout.continueShopping}
            </Link>
          </div>
        </div>

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
