"use client";

import { useEffect, useMemo, useRef } from "react";
import { AppAlert } from "@/components/ui/app-alert";
import { Card, CardContent } from "@/components/ui/card";
import { StorefrontAboutPage } from "@/components/storefront/storefront-about-page";
import { StorefrontCartPage } from "@/components/storefront/storefront-cart-page";
import { StorefrontCheckoutPage } from "@/components/storefront/storefront-checkout-page";
import { StorefrontPage } from "@/components/storefront/storefront-page";
import { StorefrontPoliciesPage } from "@/components/storefront/storefront-policies-page";
import { StorefrontProductDetailPage } from "@/components/storefront/storefront-product-detail-page";
import { StorefrontRuntimeProvider } from "@/components/storefront/storefront-runtime-provider";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { applyStorefrontStudioDraftToRuntime } from "@/lib/storefront/draft";
import { setEditorValueAtPath } from "@/lib/store-editor/object-path";
import { createStorefrontRuntime, type StorefrontData, type StorefrontSettings, type StorefrontSurface } from "@/lib/storefront/runtime";
import {
  getStorefrontStudioProductHandleForHref,
  getStorefrontStudioSurfaceForHref,
  type StorefrontStudioSurfaceId
} from "@/lib/store-editor/storefront-studio";

type StorefrontStudioCanvasProps = {
  storeSlug: string;
  surface: StorefrontStudioSurfaceId;
  initialStorefrontData: StorefrontData | null;
  activeProductDetailHandle?: string | null;
  scrollTarget?: { section: "header" | "footer"; nonce: number } | null;
  onNavigateSurface?: (surface: StorefrontStudioSurfaceId) => void;
  onProductDetailChange?: (productHandle: string | null) => void;
};

function mapSurfaceToRuntimeSurface(surface: StorefrontStudioSurfaceId, detailProductHandle: string | null): StorefrontSurface {
  switch (surface) {
    case "products":
      return detailProductHandle ? "productDetail" : "products";
    case "about":
      return "about";
    case "policies":
      return "policies";
    case "cart":
      return "cart";
    case "orderSummary":
      return "checkout";
    case "emails":
      return "home";
    case "home":
    default:
      return "home";
  }
}

function ensureCanvasSettingsDraft(current: StorefrontSettings): NonNullable<StorefrontSettings> {
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

function getAboutInlineValues(section: Record<string, unknown>) {
  const copy = section.copy;
  const about = copy && typeof copy === "object" && !Array.isArray(copy) ? (copy as Record<string, unknown>).about : null;
  if (!about || typeof about !== "object" || Array.isArray(about)) {
    return {};
  }

  const aboutRecord = about as Record<string, unknown>;

  return {
    ourStoryHeading: typeof aboutRecord.ourStoryHeading === "string" ? aboutRecord.ourStoryHeading : undefined,
    questionsHeading: typeof aboutRecord.questionsHeading === "string" ? aboutRecord.questionsHeading : undefined,
    whatShapesOurWorkHeading: typeof aboutRecord.whatShapesOurWorkHeading === "string" ? aboutRecord.whatShapesOurWorkHeading : undefined,
    needDetailsHeading: typeof aboutRecord.needDetailsHeading === "string" ? aboutRecord.needDetailsHeading : undefined,
    needDetailsBody: typeof aboutRecord.needDetailsBody === "string" ? aboutRecord.needDetailsBody : undefined,
    questionsBody: typeof aboutRecord.questionsBody === "string" ? aboutRecord.questionsBody : undefined
  };
}

function getPoliciesInlineValues(section: Record<string, unknown>) {
  const copy = section.copy;
  const policies = copy && typeof copy === "object" && !Array.isArray(copy) ? (copy as Record<string, unknown>).policies : null;
  if (!policies || typeof policies !== "object" || Array.isArray(policies)) {
    return {};
  }

  const policiesRecord = policies as Record<string, unknown>;

  return {
    title: typeof policiesRecord.title === "string" ? policiesRecord.title : undefined,
    subtitle: typeof policiesRecord.subtitle === "string" ? policiesRecord.subtitle : undefined,
    shippingHeading: typeof policiesRecord.shippingHeading === "string" ? policiesRecord.shippingHeading : undefined,
    returnsHeading: typeof policiesRecord.returnsHeading === "string" ? policiesRecord.returnsHeading : undefined,
    supportHeading: typeof policiesRecord.supportHeading === "string" ? policiesRecord.supportHeading : undefined,
    supportBodyPrefix: typeof policiesRecord.supportBodyPrefix === "string" ? policiesRecord.supportBodyPrefix : undefined,
    fallbackFaq1Question: typeof policiesRecord.fallbackFaq1Question === "string" ? policiesRecord.fallbackFaq1Question : undefined,
    fallbackFaq1Answer: typeof policiesRecord.fallbackFaq1Answer === "string" ? policiesRecord.fallbackFaq1Answer : undefined,
    fallbackFaq2Question: typeof policiesRecord.fallbackFaq2Question === "string" ? policiesRecord.fallbackFaq2Question : undefined,
    fallbackFaq2Answer: typeof policiesRecord.fallbackFaq2Answer === "string" ? policiesRecord.fallbackFaq2Answer : undefined
  };
}

function getCheckoutInlineValues(section: Record<string, unknown>) {
  const copy = section.copy;
  const checkout = copy && typeof copy === "object" && !Array.isArray(copy) ? (copy as Record<string, unknown>).checkout : null;
  if (!checkout || typeof checkout !== "object" || Array.isArray(checkout)) {
    return {};
  }

  const checkoutRecord = checkout as Record<string, unknown>;

  return {
    title: typeof checkoutRecord.title === "string" ? checkoutRecord.title : undefined,
    cancelled: typeof checkoutRecord.cancelled === "string" ? checkoutRecord.cancelled : undefined,
    orderPlacedTemplate: typeof checkoutRecord.orderPlacedTemplate === "string" ? checkoutRecord.orderPlacedTemplate : undefined,
    finalizationFailed: typeof checkoutRecord.finalizationFailed === "string" ? checkoutRecord.finalizationFailed : undefined
  };
}

function updateCopySectionField(
  section: Record<string, unknown>,
  namespace: "about" | "policies",
  field: string,
  value: string
) {
  const currentCopy = section.copy && typeof section.copy === "object" && !Array.isArray(section.copy) ? (section.copy as Record<string, unknown>) : {};
  const currentNamespace =
    currentCopy[namespace] && typeof currentCopy[namespace] === "object" && !Array.isArray(currentCopy[namespace])
      ? (currentCopy[namespace] as Record<string, unknown>)
      : {};

  return {
    ...section,
    copy: {
      ...currentCopy,
      [namespace]: {
        ...currentNamespace,
        [field]: value
      }
    }
  };
}

function updateAboutSectionField(section: Record<string, unknown>, sectionId: string, field: "title" | "body", value: string) {
  const aboutSections = Array.isArray(section.aboutSections)
    ? section.aboutSections.map((entry) =>
        entry && typeof entry === "object" && !Array.isArray(entry) && String((entry as Record<string, unknown>).id ?? "") === sectionId
          ? {
              ...(entry as Record<string, unknown>),
              [field]: value
            }
          : entry
      )
    : [];

  return {
    ...section,
    aboutSections
  };
}

export function StorefrontStudioCanvas({
  storeSlug,
  surface,
  initialStorefrontData,
  activeProductDetailHandle = null,
  scrollTarget,
  onNavigateSurface,
  onProductDetailChange
}: StorefrontStudioCanvasProps) {
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const studioDocument = useOptionalStorefrontStudioDocument();
  const activeDetailProductHandle = surface === "products" ? activeProductDetailHandle : null;
  const runtime = useMemo(() => {
    if (!initialStorefrontData) {
      return null;
    }

    const next = createStorefrontRuntime({
      ...initialStorefrontData,
      mode: "studio",
      surface: mapSurfaceToRuntimeSurface(surface, activeDetailProductHandle)
    });

    if (!studioDocument) {
      return next;
    }

    return applyStorefrontStudioDraftToRuntime(next, studioDocument.draft);
  }, [activeDetailProductHandle, studioDocument, initialStorefrontData, surface]);

  const aboutSection = studioDocument?.getSectionDraft("aboutPage") ?? {};
  const policiesSection = studioDocument?.getSectionDraft("policiesPage") ?? {};
  const checkoutSection = studioDocument?.getSectionDraft("orderSummaryPage") ?? {};
  const detailProduct =
    activeDetailProductHandle && initialStorefrontData
      ? (initialStorefrontData.products.find((product) => product.id === activeDetailProductHandle || product.slug === activeDetailProductHandle) ?? null)
      : null;

  useEffect(() => {
    if (!scrollTarget) {
      return;
    }

    const scrollRoot = scrollRootRef.current;
    const ownerDocument = scrollRoot?.ownerDocument;

    if (!scrollRoot || !ownerDocument) {
      return;
    }

    const target = ownerDocument.querySelector<HTMLElement>(`[data-storefront-preview-section='${scrollTarget.section}']`);

    if (!target) {
      return;
    }

    requestAnimationFrame(() => {
      const rootTop = scrollRoot.getBoundingClientRect().top;
      const targetTop = target.getBoundingClientRect().top;
      const offset = scrollTarget.section === "header" ? 12 : 24;
      const nextScroll = scrollRoot.scrollTop + (targetTop - rootTop) - offset;
      scrollRoot.scrollTo({ top: Math.max(0, nextScroll), behavior: "smooth" });
    });
  }, [scrollTarget]);

  if (!runtime || !initialStorefrontData) {
    return (
      <Card className="min-h-[32rem] border-dashed border-border/70">
        <CardContent className="flex h-full min-h-[32rem] items-center justify-center p-6">
          <div className="max-w-md space-y-3 text-center">
            <p className="text-sm font-medium">Storefront preview unavailable</p>
            <p className="text-sm text-muted-foreground">The Studio couldn’t load storefront data for this store. Check the store slug and storefront access state.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  function handleCanvasClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest("[data-studio-ignore-navigation='true']")) {
      return;
    }

    const anchor = target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) {
      return;
    }

    const href = anchor.getAttribute("href");
    if (!href) {
      return;
    }

    const productHandle = getStorefrontStudioProductHandleForHref(anchor.href, storeSlug);
    const nextSurface = getStorefrontStudioSurfaceForHref(anchor.href, storeSlug);
    event.preventDefault();

    if (productHandle) {
      onNavigateSurface?.("products");
      onProductDetailChange?.(productHandle);
      return;
    }

    if (nextSurface === "products") {
      onProductDetailChange?.(null);
    }

    if (nextSurface) {
      onNavigateSurface?.(nextSurface);
    }
  }

  function handleCanvasPointerDownCapture(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest("[data-studio-ignore-navigation='true']")) {
      return;
    }

    if (target.closest("[data-studio-selection-kind]")) {
      return;
    }

    target.ownerDocument.getSelection?.()?.removeAllRanges();
  }

  return (
    <StorefrontRuntimeProvider runtime={runtime}>
      <div
        ref={scrollRootRef}
        data-storefront-scroll-root="true"
        onPointerDownCapture={handleCanvasPointerDownCapture}
        onClickCapture={handleCanvasClickCapture}
        className="h-full min-h-[32rem] overflow-auto rounded-[1rem] border border-slate-300 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.14)] [scrollbar-gutter:stable]"
      >
        <AppAlert variant="error" compact message={studioDocument?.error ?? null} />
        {surface === "products" ? (
          detailProduct ? (
            <StorefrontProductDetailPage
              store={initialStorefrontData.store}
              viewer={initialStorefrontData.viewer}
              branding={initialStorefrontData.branding}
              settings={initialStorefrontData.settings}
              product={detailProduct}
            />
          ) : (
            <StorefrontPage
              store={initialStorefrontData.store}
              viewer={initialStorefrontData.viewer}
              branding={initialStorefrontData.branding}
              settings={initialStorefrontData.settings}
              contentBlocks={initialStorefrontData.contentBlocks}
              products={initialStorefrontData.products}
              view="products"
            />
          )
        ) : null}
        {surface === "about" ? (
          <StorefrontAboutPage
            store={initialStorefrontData.store}
            viewer={initialStorefrontData.viewer}
            branding={initialStorefrontData.branding}
            settings={initialStorefrontData.settings}
            contentBlocks={initialStorefrontData.contentBlocks}
            studio={{
              enabled: true,
              inlineValues: getAboutInlineValues(aboutSection),
              onInlineChange: (field, value) => studioDocument?.setSectionDraft("aboutPage", (current) => updateCopySectionField(current, "about", field, value)),
              onAnnouncementChange: (value) => studioDocument?.setSectionDraft("home", (current) => setEditorValueAtPath(current, "announcement", value)),
              onFulfillmentMessageChange: (value) =>
                studioDocument?.setSectionDraft("home", (current) => setEditorValueAtPath(current, "fulfillmentMessage", value)),
              onSupportEmailChange: (value) =>
                studioDocument?.setSectionDraft("policiesPage", (current) => setEditorValueAtPath(current, "supportEmail", value)),
              onArticleChange: (value) =>
                studioDocument?.setSectionDraft("aboutPage", (current) => setEditorValueAtPath(current, "aboutArticleHtml", value)),
              onSectionChange: (sectionId, field, value) =>
                studioDocument?.setSectionDraft("aboutPage", (current) => updateAboutSectionField(current, sectionId, field, value))
            }}
          />
        ) : null}
        {surface === "policies" ? (
          <StorefrontPoliciesPage
            store={initialStorefrontData.store}
            viewer={initialStorefrontData.viewer}
            branding={initialStorefrontData.branding}
            settings={initialStorefrontData.settings}
            studio={{
              enabled: true,
              inlineValues: getPoliciesInlineValues(policiesSection),
              onInlineChange: (field, value) => studioDocument?.setSectionDraft("policiesPage", (current) => updateCopySectionField(current, "policies", field, value)),
              onAnnouncementChange: (value) => studioDocument?.setSectionDraft("home", (current) => setEditorValueAtPath(current, "announcement", value)),
              onShippingPolicyChange: (value) =>
                studioDocument?.setSectionDraft("policiesPage", (current) => setEditorValueAtPath(current, "shippingPolicy", value)),
              onReturnPolicyChange: (value) =>
                studioDocument?.setSectionDraft("policiesPage", (current) => setEditorValueAtPath(current, "returnPolicy", value)),
              onSupportEmailChange: (value) => studioDocument?.setSectionDraft("policiesPage", (current) => setEditorValueAtPath(current, "supportEmail", value))
            }}
          />
        ) : null}
        {surface === "cart" ? (
          <StorefrontCartPage
            store={initialStorefrontData.store}
            viewer={initialStorefrontData.viewer}
            branding={initialStorefrontData.branding}
            settings={initialStorefrontData.settings}
            products={initialStorefrontData.products}
            studio={{
              enabled: true,
              onTitleChange: (value) => studioDocument?.setSectionDraft("cartPage", (current) => setEditorValueAtPath(current, "copy.cart.title", value)),
              onSubtitleChange: (value) => studioDocument?.setSectionDraft("cartPage", (current) => setEditorValueAtPath(current, "copy.cart.subtitle", value)),
              onEmptyMessageChange: (value) => studioDocument?.setSectionDraft("cartPage", (current) => setEditorValueAtPath(current, "copy.cart.empty", value)),
              onCheckoutLabelChange: (value) => studioDocument?.setSectionDraft("cartPage", (current) => setEditorValueAtPath(current, "copy.cart.checkout", value)),
              onOrderNotePromptChange: (value) =>
                studioDocument?.setSettingsDraft((current) => ({
                  ...ensureCanvasSettingsDraft(current),
                  checkout_order_note_prompt: value
                }))
            }}
          />
        ) : null}
        {surface === "orderSummary" ? (
          <StorefrontCheckoutPage
            store={initialStorefrontData.store}
            viewer={initialStorefrontData.viewer}
            branding={initialStorefrontData.branding}
            settings={initialStorefrontData.settings}
            studio={{
              enabled: true,
              inlineValues: getCheckoutInlineValues(checkoutSection),
              onInlineChange: (field, value) =>
                studioDocument?.setSectionDraft("orderSummaryPage", (current) => setEditorValueAtPath(current, `copy.checkout.${field}`, value))
            }}
          />
        ) : null}
        {surface === "emails" ? (
          <StorefrontPage
            store={initialStorefrontData.store}
            viewer={initialStorefrontData.viewer}
            branding={initialStorefrontData.branding}
            settings={initialStorefrontData.settings}
            contentBlocks={initialStorefrontData.contentBlocks}
            products={initialStorefrontData.products}
            emailStudio
          />
        ) : null}
        {surface === "home" ? (
          <StorefrontPage
            store={initialStorefrontData.store}
            viewer={initialStorefrontData.viewer}
            branding={initialStorefrontData.branding}
            settings={initialStorefrontData.settings}
            contentBlocks={initialStorefrontData.contentBlocks}
            products={initialStorefrontData.products}
          />
        ) : null}
      </div>
    </StorefrontRuntimeProvider>
  );
}
