"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { StorefrontStudioCheckoutPreviewStatePicker, type StorefrontStudioCheckoutPreviewState } from "@/components/storefront/storefront-studio-checkout-preview-state-picker";
import { StorefrontStudioEditableText } from "@/components/storefront/storefront-studio-editable-text";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
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
import {
  buildStorefrontCartPath,
  buildStorefrontPoliciesPath,
  buildStorefrontProductsPath
} from "@/lib/storefront/paths";
import { cn } from "@/lib/utils";
import { CHECKOUT_RETURN_POLLING } from "@/lib/storefront/checkout-return-polling";

type CheckoutStatusResponse = {
  status?: "pending" | "completed" | "delivery_failed" | "failed";
  orderId?: string | null;
  checkoutComposition?: "digital_only" | "physical_only" | "mixed";
  digitalDeliveryStatus?: "pending" | "processing" | "succeeded" | "failed";
  digitalAccessUrl?: string;
  error?: string;
};

const digitalDeliveryFailedFallback =
  "Payment was received, but the digital downloads could not be prepared. Contact the store for help with this order.";

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
    checkout_notice?: string | null;
  } | null;
  studio?: {
    enabled: boolean;
    previewComposition?: "digital_only" | "mixed";
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
  const checkoutCompositionParam = searchParams.get("checkoutComposition");
  const initialCheckoutComposition = checkoutCompositionParam === "digital_only"
    || checkoutCompositionParam === "physical_only"
    || checkoutCompositionParam === "mixed"
    ? checkoutCompositionParam
    : null;

  const resolvedStore = runtime?.store ?? store;
  const resolvedViewer = runtime?.viewer ?? viewer;
  const resolvedBranding = runtime?.branding ?? branding;
  const resolvedPresentation = runtime ? resolveStorefrontPresentation(runtime) : null;
  const resolvedSettings = resolvedPresentation?.settings ?? settings;
  const themeConfig = resolvedPresentation?.themeConfig ?? resolveStorefrontThemeConfig(resolvedBranding?.theme_json ?? {});
  const copy = resolvedPresentation?.copy ?? resolveStorefrontCopy(resolvedSettings?.storefront_copy_json ?? {});
  const routeBasePath = runtime?.routeBasePath ?? "";
  const headerNavLinks = resolveHeaderNavLinks(themeConfig, copy, resolvedStore.slug, routeBasePath);
  const footerNavLinks = resolveFooterNavLinks(themeConfig, copy, resolvedStore.slug, routeBasePath);
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
  const [deliveryFailureOrderId, setDeliveryFailureOrderId] = useState<string | null>(null);
  const [digitalDeliveryStatus, setDigitalDeliveryStatus] = useState<"pending" | "processing" | "succeeded" | "failed" | null>(null);
  const [digitalAccessUrl, setDigitalAccessUrl] = useState<string | null>(null);
  const [checkoutCompositionState, setCheckoutComposition] = useState<"digital_only" | "physical_only" | "mixed" | null>(initialCheckoutComposition);
  const checkoutComposition = studio?.previewComposition ?? checkoutCompositionState;
  const checkoutCompositionRef = useRef<"digital_only" | "physical_only" | "mixed" | null>(initialCheckoutComposition);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [pollRequest, setPollRequest] = useState(0);
  const isPollingDigitalDelivery = checkoutComposition === "digital_only" || checkoutComposition === "mixed";

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

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      setPollTimedOut(true);
    }, CHECKOUT_RETURN_POLLING.timeoutMs);

    async function poll() {
      setMessage(checkoutPaymentReceivedFinalizing);
      setError(null);
      setDeliveryFailureOrderId(null);
      setPollTimedOut(false);

      for (let attempt = 0; !controller.signal.aborted; attempt += 1) {
        let response: Response | null = null;
        let payload: CheckoutStatusResponse;
        try {
          response = await fetch(
            `/api/orders/checkout-status?sessionId=${encodeURIComponent(safeSessionId)}&store=${encodeURIComponent(resolvedStore.slug)}`,
            { cache: "no-store", signal: controller.signal }
          );
          payload = (await response.json()) as CheckoutStatusResponse;
        } catch {
          if (controller.signal.aborted) return;
          payload = {};
        }
        if (controller.signal.aborted) return;

        if (response?.ok && payload.status === "completed" && payload.orderId) {
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
          if (payload.checkoutComposition) {
            checkoutCompositionRef.current = payload.checkoutComposition;
            setCheckoutComposition(payload.checkoutComposition);
          }
          if (payload.digitalDeliveryStatus) {
            setDigitalDeliveryStatus(payload.digitalDeliveryStatus);
          }
          if (
            payload.digitalDeliveryStatus === "succeeded" &&
            typeof payload.digitalAccessUrl === "string" &&
            /^\/downloads\/[A-Za-z0-9_-]{43}$/.test(payload.digitalAccessUrl)
          ) {
            setDigitalAccessUrl(payload.digitalAccessUrl);
            setPollTimedOut(false);
            return;
          }
          if (!payload.digitalDeliveryStatus) {
            if (checkoutCompositionRef.current === "digital_only" || checkoutCompositionRef.current === "mixed") {
              continue;
            }
            setPollTimedOut(false);
            return;
          }
        }

        if (payload.status === "delivery_failed") {
          if (payload.orderId) {
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
            setDeliveryFailureOrderId(payload.orderId);
          }
          setError(payload.error ?? digitalDeliveryFailedFallback);
          setDigitalDeliveryStatus("failed");
          if (payload.checkoutComposition) {
            checkoutCompositionRef.current = payload.checkoutComposition;
            setCheckoutComposition(payload.checkoutComposition);
          }
          setPollTimedOut(false);
          return;
        }

        if (payload.status === "failed") {
          setError(payload.error ?? finalizationFailedMessage);
          setPollTimedOut(false);
          return;
        }

        const delayMs = Math.min(
          CHECKOUT_RETURN_POLLING.initialDelayMs * CHECKOUT_RETURN_POLLING.backoffMultiplier ** attempt,
          CHECKOUT_RETURN_POLLING.maximumDelayMs
        );
        await new Promise<void>((resolve) => {
          let delay: ReturnType<typeof setTimeout> | null = null;
          const finish = () => {
            if (delay) clearTimeout(delay);
            controller.signal.removeEventListener("abort", finish);
            resolve();
          };
          delay = setTimeout(finish, delayMs);
          controller.signal.addEventListener("abort", finish, { once: true });
        });
        if (controller.signal.aborted) return;
      }
    }

    void poll().finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [analytics, checkoutPaymentReceivedFinalizing, finalizationFailedMessage, orderPlacedTemplate, pollRequest, resolvedStore.slug, sessionId, status, studioEnabled]);

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
  const supportEmail = resolvedSettings?.support_email?.trim();
  const deliveryFailureSupportAction = deliveryFailureOrderId ? (
    supportEmail ? (
      <a
        href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Digital download help for order ${deliveryFailureOrderId}`)}`}
        className={`font-medium ${STOREFRONT_TEXT_LINK_EFFECT_CLASS}`}
      >
        Contact store support
      </a>
    ) : (
      <Link
        href={buildStorefrontPoliciesPath(resolvedStore.slug, routeBasePath)}
        className={`font-medium ${STOREFRONT_TEXT_LINK_EFFECT_CLASS}`}
      >
        View store support information
      </Link>
    )
  ) : null;

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
        {resolvedSettings?.checkout_notice ? (
          <div className={cn("mx-auto max-w-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900", radiusClass)}>
            {resolvedSettings.checkout_notice}
          </div>
        ) : null}

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
          {!studioEnabled && isPollingDigitalDelivery && (digitalDeliveryStatus !== "failed" || checkoutComposition === "mixed") ? (
            <section
              aria-live="polite"
              className={cn("space-y-3 border border-border/60 bg-muted/20 p-4", radiusClass)}
            >
              {digitalDeliveryStatus === "succeeded" && digitalAccessUrl ? (
                <>
                  <div>
                    <h2 className="text-lg font-semibold">Downloads ready</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Open your files now. A secure 48-hour access link was also emailed to you.
                    </p>
                  </div>
                  <Link
                    href={digitalAccessUrl}
                    className={cn(
                      "inline-flex min-h-11 items-center justify-center bg-[var(--storefront-accent)] px-5 text-sm font-semibold text-[color:var(--storefront-accent-foreground)] transition hover:opacity-90",
                      buttonRadiusClass
                    )}
                  >
                    View downloads
                  </Link>
                </>
              ) : digitalDeliveryStatus !== "failed" ? (
                <div role="status">
                  <h2 className="text-lg font-semibold">{pollTimedOut ? "Still preparing files" : "Preparing files"}</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {pollTimedOut
                      ? "Payment is complete, but file preparation is taking longer than expected. You can safely check the status again."
                      : "Payment is complete. Keep this page open while secure access is finalized; retrying this page will not charge you again."}
                  </p>
                  {pollTimedOut ? (
                    <Button type="button" variant="outline" className={cn("mt-3", buttonRadiusClass)} onClick={() => setPollRequest((value) => value + 1)}>
                      Check again
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {checkoutComposition === "mixed" ? (
                <p className="border-t border-border/60 pt-3 text-sm text-muted-foreground">
                  Your physical items will continue through shipping or pickup separately.
                </p>
              ) : null}
            </section>
          ) : null}
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
            <AppAlert
              variant="error"
              title={deliveryFailureOrderId ? "Digital delivery needs help" : undefined}
              message={previewError}
              action={deliveryFailureSupportAction}
            />
          )}
          <div className="flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <Link href={buildStorefrontCartPath(resolvedStore.slug, routeBasePath)} className={`font-medium ${STOREFRONT_TEXT_LINK_EFFECT_CLASS}`}>
              {copy.checkout.backToCart}
            </Link>
            <Link href={buildStorefrontProductsPath(resolvedStore.slug, routeBasePath)} className={`font-medium ${STOREFRONT_TEXT_LINK_EFFECT_CLASS}`}>
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
