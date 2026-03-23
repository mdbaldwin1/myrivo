"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StorefrontStudioPreviewViewport } from "@/components/dashboard/storefront-studio-preview-viewport";
import { StorefrontAboutPage } from "@/components/storefront/storefront-about-page";
import { StorefrontCartPage } from "@/components/storefront/storefront-cart-page";
import { StorefrontCheckoutPage } from "@/components/storefront/storefront-checkout-page";
import { StorefrontPage } from "@/components/storefront/storefront-page";
import { StorefrontPoliciesPage } from "@/components/storefront/storefront-policies-page";
import { StorefrontProductDetailPage } from "@/components/storefront/storefront-product-detail-page";
import { StorefrontRuntimeProvider } from "@/components/storefront/storefront-runtime-provider";
import {
  getStorefrontStudioProductHandleForHref,
  getStorefrontStudioSurfaceForHref,
  type StorefrontStudioSurfaceId
} from "@/lib/store-editor/storefront-studio";
import { createStorefrontRuntime, type StorefrontData, type StorefrontSurface } from "@/lib/storefront/runtime";

const demoProductImageA =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ede6fb"/>
          <stop offset="100%" stop-color="#f7f3ff"/>
        </linearGradient>
      </defs>
      <rect width="600" height="600" rx="48" fill="url(#bg)"/>
      <rect x="220" y="120" width="160" height="330" rx="56" fill="#5f4c8c"/>
      <rect x="205" y="110" width="190" height="62" rx="28" fill="#c8b7ea"/>
      <rect x="240" y="205" width="120" height="90" rx="12" fill="#f5f0ff"/>
      <rect x="250" y="220" width="100" height="12" rx="6" fill="#6f5ba2"/>
      <rect x="250" y="242" width="78" height="10" rx="5" fill="#8f7ac2"/>
    </svg>
  `);

const demoProductImageB =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#dff1f0"/>
          <stop offset="100%" stop-color="#f3fbfb"/>
        </linearGradient>
      </defs>
      <rect width="600" height="600" rx="48" fill="url(#bg)"/>
      <ellipse cx="300" cy="340" rx="130" ry="110" fill="#77b6b1"/>
      <ellipse cx="300" cy="318" rx="115" ry="96" fill="#eff8f7"/>
      <ellipse cx="300" cy="298" rx="88" ry="66" fill="#b9dfdb"/>
      <rect x="225" y="180" width="150" height="42" rx="18" fill="#427f84"/>
    </svg>
  `);

const DEMO_STOREFRONT_DATA: StorefrontData = {
  store: {
    id: "demo-store",
    name: "Juniper & Loom",
    slug: "juniper-and-loom"
  },
  viewer: {
    isAuthenticated: false,
    canManageStore: false
  },
  analytics: {
    planKey: null,
    planAllowsAnalytics: false,
    collectionEnabled: false,
    dashboardEnabled: false
  },
  branding: {
    logo_path: "/brand/myrivo-mark.svg",
    primary_color: "#5e468f",
    accent_color: "#2e9d98",
    theme_json: {
      heroLayout: "centered",
      pageWidth: "standard",
      spacingScale: "comfortable",
      radiusScale: "soft",
      cardStyle: "framed",
      productGridColumns: 2,
      heroEyebrow: "Handmade skincare",
      heroHeadline: "Simple ingredients. Premium presentation.",
      heroSubcopy:
        "Tallow balms, lip care, and small-batch body products made to feel at home in a beautiful storefront.",
      heroShowTitle: false,
      heroBadgeOne: "Small-batch care",
      heroBadgeTwo: "Pickup + shipping",
      heroBadgeThree: "Seasonal drops",
      reviewsEnabled: false,
      reviewsShowOnHome: false,
      reviewsShowOnProductDetail: false
    }
  },
  settings: {
    support_email: "hello@juniperandloom.com",
    fulfillment_message: "Pickup on Fridays. Flat-rate shipping available for domestic orders.",
    shipping_policy: "Flat-rate shipping on all domestic orders.",
    return_policy: "Returns accepted within 14 days on unopened items.",
    announcement: "Free local pickup this Friday and Saturday",
    footer_tagline: "Small-batch skincare for everyday rituals.",
    footer_note: "Made with simple ingredients and careful batches.",
    instagram_url: "https://instagram.com/juniperandloom",
    facebook_url: null,
    tiktok_url: null,
    email_capture_enabled: false,
    storefront_copy_json: null
  },
  privacyProfile: null,
  experienceContent: {
    home: {},
    productsPage: {},
    aboutPage: {},
    policiesPage: {},
    cartPage: {},
    orderSummaryPage: {},
    emails: {}
  },
  contentBlocks: [
    {
      id: "demo-block-1",
      sort_order: 1,
      eyebrow: "Why customers come back",
      title: "Clean ingredients. A calmer storefront experience.",
      body: "Tell your story, show your products clearly, and keep checkout, promos, and fulfillment in one connected workflow.",
      cta_label: "Read our story",
      cta_url: "/s/juniper-and-loom/about",
      is_active: true
    }
  ],
  products: [
    {
      id: "demo-product-1",
      title: "Whipped Tallow Balm",
      description: "A rich, small-batch balm with a clean ingredient list and a soft whipped finish.",
      slug: "whipped-tallow-balm",
      image_urls: [demoProductImageA],
      image_alt_text: "Whipped tallow balm jar",
      seo_title: null,
      seo_description: null,
      is_featured: true,
      created_at: "2026-03-01T00:00:00.000Z",
      price_cents: 2400,
      inventory_qty: 14,
      product_variants: [
        {
          id: "demo-variant-1",
          title: "2 oz",
          image_urls: [demoProductImageA],
          group_image_urls: [],
          option_values: { Size: "2 oz" },
          price_cents: 2400,
          inventory_qty: 14,
          is_made_to_order: false,
          is_default: true,
          status: "active",
          sort_order: 1,
          created_at: "2026-03-01T00:00:00.000Z"
        }
      ],
      product_option_axes: [
        {
          id: "demo-axis-1",
          name: "Size",
          sort_order: 1,
          is_required: true,
          product_option_values: [
            {
              id: "demo-axis-value-1",
              value: "2 oz",
              sort_order: 1,
              is_active: true
            }
          ]
        }
      ]
    },
    {
      id: "demo-product-2",
      title: "Botanical Lip Balm",
      description: "Pocket-sized hydration with a smooth finish and a subtle botanical profile.",
      slug: "botanical-lip-balm",
      image_urls: [demoProductImageB],
      image_alt_text: "Botanical lip balm tin",
      seo_title: null,
      seo_description: null,
      is_featured: true,
      created_at: "2026-03-02T00:00:00.000Z",
      price_cents: 900,
      inventory_qty: 27,
      product_variants: [
        {
          id: "demo-variant-2",
          title: "Default",
          image_urls: [demoProductImageB],
          group_image_urls: [],
          option_values: {},
          price_cents: 900,
          inventory_qty: 27,
          is_made_to_order: false,
          is_default: true,
          status: "active",
          sort_order: 1,
          created_at: "2026-03-02T00:00:00.000Z"
        }
      ]
    }
  ]
};

function mapSurfaceToRuntimeSurface(surface: StorefrontStudioSurfaceId, activeProductHandle: string | null): StorefrontSurface {
  switch (surface) {
    case "products":
      return activeProductHandle ? "productDetail" : "products";
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

export function MarketingHomepageStorefrontPreview() {
  const previewRootRef = useRef<HTMLDivElement | null>(null);
  const [surface, setSurface] = useState<StorefrontStudioSurfaceId>("home");
  const [activeProductHandle, setActiveProductHandle] = useState<string | null>(null);

  function navigatePreviewToHref(href: string) {
    const productHandle = getStorefrontStudioProductHandleForHref(href, DEMO_STOREFRONT_DATA.store.slug);
    const nextSurface = getStorefrontStudioSurfaceForHref(href, DEMO_STOREFRONT_DATA.store.slug);

    if (productHandle) {
      setSurface("products");
      setActiveProductHandle(productHandle);
      return;
    }

    if (nextSurface === "products") {
      setActiveProductHandle(null);
    }

    if (nextSurface) {
      setSurface(nextSurface);
    }
  }

  const runtime = useMemo(
    () => {
      const next = createStorefrontRuntime({
        ...DEMO_STOREFRONT_DATA,
        mode: "studio",
        surface: mapSurfaceToRuntimeSurface(surface, activeProductHandle)
      });
      next.previewNavigateToHref = navigatePreviewToHref;
      return next;
    },
    [activeProductHandle, surface]
  );

  const activeProduct =
    activeProductHandle
      ? DEMO_STOREFRONT_DATA.products.find((product) => product.id === activeProductHandle || product.slug === activeProductHandle) ?? null
      : null;

  useEffect(() => {
    const previewRoot = previewRootRef.current;
    const ownerDocument = previewRoot?.ownerDocument;

    if (!previewRoot || !ownerDocument) {
      return;
    }

    const resolvedOwnerDocument = ownerDocument;

    function handlePreviewClickCapture(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (!target.closest("[data-homepage-storefront-preview='true'], [data-storefront-preview-nav-sheet='true']")) {
        return;
      }

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      const productHandle = getStorefrontStudioProductHandleForHref(anchor.href, DEMO_STOREFRONT_DATA.store.slug);
      const nextSurface = getStorefrontStudioSurfaceForHref(anchor.href, DEMO_STOREFRONT_DATA.store.slug);

      if (!productHandle && !nextSurface) {
        event.preventDefault();
        return;
      }

      event.preventDefault();

      if (productHandle) {
        setSurface("products");
        setActiveProductHandle(productHandle);
        return;
      }

      if (nextSurface === "products") {
        setActiveProductHandle(null);
      }

      if (nextSurface) {
        setSurface(nextSurface);
      }
    }

    function handlePreviewNavigate(event: Event) {
      const customEvent = event as CustomEvent<{ href?: string }>;
      const href = customEvent.detail?.href;

      if (!href) {
        return;
      }

      const absoluteHref = new URL(href, resolvedOwnerDocument.defaultView?.location.href ?? "https://myrivo.local").href;
      const productHandle = getStorefrontStudioProductHandleForHref(absoluteHref, DEMO_STOREFRONT_DATA.store.slug);
      const nextSurface = getStorefrontStudioSurfaceForHref(absoluteHref, DEMO_STOREFRONT_DATA.store.slug);

      if (productHandle) {
        setSurface("products");
        setActiveProductHandle(productHandle);
        return;
      }

      if (nextSurface === "products") {
        setActiveProductHandle(null);
      }

      if (nextSurface) {
        setSurface(nextSurface);
      }
    }

    resolvedOwnerDocument.addEventListener("click", handlePreviewClickCapture, true);
    resolvedOwnerDocument.addEventListener("myrivo:storefront-preview-navigate", handlePreviewNavigate as EventListener);
    return () => {
      resolvedOwnerDocument.removeEventListener("click", handlePreviewClickCapture, true);
      resolvedOwnerDocument.removeEventListener("myrivo:storefront-preview-navigate", handlePreviewNavigate as EventListener);
    };
  }, []);

  return (
    <div className="relative h-[640px] w-full max-w-[390px] overflow-hidden rounded-[2rem] border border-border bg-white shadow-[0_24px_60px_rgba(18,34,26,0.14)]">
      <StorefrontStudioPreviewViewport title="Homepage storefront preview" widthPx={390}>
        <StorefrontRuntimeProvider runtime={runtime}>
          <div data-storefront-scroll-root="true" className="h-full min-h-full overflow-auto [scrollbar-gutter:stable]">
            <div ref={previewRootRef} data-homepage-storefront-preview="true" className="min-h-full">
              {surface === "products" ? (
                activeProduct ? (
                  <StorefrontProductDetailPage
                    store={DEMO_STOREFRONT_DATA.store}
                    viewer={DEMO_STOREFRONT_DATA.viewer}
                    branding={DEMO_STOREFRONT_DATA.branding}
                    settings={DEMO_STOREFRONT_DATA.settings}
                    product={activeProduct}
                    reviewsEnabled={false}
                  />
                ) : (
                  <StorefrontPage
                    store={DEMO_STOREFRONT_DATA.store}
                    viewer={DEMO_STOREFRONT_DATA.viewer}
                    branding={DEMO_STOREFRONT_DATA.branding}
                    settings={DEMO_STOREFRONT_DATA.settings}
                    contentBlocks={DEMO_STOREFRONT_DATA.contentBlocks}
                    products={DEMO_STOREFRONT_DATA.products}
                    view="products"
                    reviewsEnabled={false}
                  />
                )
              ) : null}
              {surface === "about" ? (
                <StorefrontAboutPage
                  store={DEMO_STOREFRONT_DATA.store}
                  viewer={DEMO_STOREFRONT_DATA.viewer}
                  branding={DEMO_STOREFRONT_DATA.branding}
                  settings={DEMO_STOREFRONT_DATA.settings}
                  contentBlocks={DEMO_STOREFRONT_DATA.contentBlocks}
                />
              ) : null}
              {surface === "policies" ? (
                <StorefrontPoliciesPage
                  store={DEMO_STOREFRONT_DATA.store}
                  viewer={DEMO_STOREFRONT_DATA.viewer}
                  branding={DEMO_STOREFRONT_DATA.branding}
                  settings={DEMO_STOREFRONT_DATA.settings}
                />
              ) : null}
              {surface === "cart" ? (
                <StorefrontCartPage
                  store={DEMO_STOREFRONT_DATA.store}
                  viewer={DEMO_STOREFRONT_DATA.viewer}
                  branding={DEMO_STOREFRONT_DATA.branding}
                  settings={DEMO_STOREFRONT_DATA.settings}
                  products={DEMO_STOREFRONT_DATA.products}
                />
              ) : null}
              {surface === "orderSummary" ? (
                <StorefrontCheckoutPage
                  store={DEMO_STOREFRONT_DATA.store}
                  viewer={DEMO_STOREFRONT_DATA.viewer}
                  branding={DEMO_STOREFRONT_DATA.branding}
                  settings={DEMO_STOREFRONT_DATA.settings}
                />
              ) : null}
              {surface === "home" || surface === "emails" ? (
                <StorefrontPage
                  store={DEMO_STOREFRONT_DATA.store}
                  viewer={DEMO_STOREFRONT_DATA.viewer}
                  branding={DEMO_STOREFRONT_DATA.branding}
                  settings={DEMO_STOREFRONT_DATA.settings}
                  contentBlocks={DEMO_STOREFRONT_DATA.contentBlocks}
                  products={DEMO_STOREFRONT_DATA.products}
                  view="home"
                  reviewsEnabled={false}
                  emailStudio={surface === "emails"}
                />
              ) : null}
            </div>
          </div>
        </StorefrontRuntimeProvider>
      </StorefrontStudioPreviewViewport>
    </div>
  );
}
