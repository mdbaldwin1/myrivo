"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getStorefrontButtonRadiusClass,
  getStorefrontCardStyleClass,
  getStorefrontRadiusClass
} from "@/lib/storefront/appearance";
import { getStorefrontPageWidthClass } from "@/lib/storefront/layout";

export function useStorefrontCookieTheme() {
  const [storefrontThemeState, setStorefrontThemeState] = useState(() => {
    if (typeof document === "undefined") {
      return {
        slug: null as string | null,
        radiusScale: null as string | null,
        cardStyle: null as string | null,
        pageWidth: null as string | null,
        spacingScale: null as string | null,
        isActive: false
      };
    }

    return {
      slug: document.body.dataset.storefrontSlug ?? null,
      radiusScale: document.body.dataset.storefrontRadiusScale ?? null,
      cardStyle: document.body.dataset.storefrontCardStyle ?? null,
      pageWidth: document.body.dataset.storefrontPageWidth ?? null,
      spacingScale: document.body.dataset.storefrontSpacingScale ?? null,
      isActive: document.body.dataset.storefrontThemeActive === "true"
    };
  });

  useEffect(() => {
    function syncFromBody() {
      setStorefrontThemeState({
        slug: document.body.dataset.storefrontSlug ?? null,
        radiusScale: document.body.dataset.storefrontRadiusScale ?? null,
        cardStyle: document.body.dataset.storefrontCardStyle ?? null,
        pageWidth: document.body.dataset.storefrontPageWidth ?? null,
        spacingScale: document.body.dataset.storefrontSpacingScale ?? null,
        isActive: document.body.dataset.storefrontThemeActive === "true"
      });
    }

    syncFromBody();
    const observer = new MutationObserver(syncFromBody);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: [
        "data-storefront-slug",
        "data-storefront-radius-scale",
        "data-storefront-card-style",
        "data-storefront-page-width",
        "data-storefront-spacing-scale",
        "data-storefront-theme-active"
      ]
    });
    window.addEventListener("popstate", syncFromBody);
    window.addEventListener("myrivo:local-storage-change", syncFromBody);
    window.addEventListener("myrivo:storefront-theme-change", syncFromBody);

    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", syncFromBody);
      window.removeEventListener("myrivo:local-storage-change", syncFromBody);
      window.removeEventListener("myrivo:storefront-theme-change", syncFromBody);
    };
  }, []);

  return useMemo(() => {
    const resolveStoreCookiePolicyHref = () => {
      if (typeof window === "undefined") {
        return storefrontThemeState.slug ? `/s/${encodeURIComponent(storefrontThemeState.slug)}/cookies` : "/cookies";
      }

      const params = new URLSearchParams(window.location.search);
      const queryStore = params.get("store")?.trim();
      if (queryStore) {
        return `/cookies?store=${encodeURIComponent(queryStore)}`;
      }

      const storefrontMatch = window.location.pathname.match(/^\/s\/([^/]+)/);
      if (storefrontMatch?.[1]) {
        return `/s/${encodeURIComponent(storefrontMatch[1])}/cookies`;
      }

      if (storefrontThemeState.slug) {
        return `/s/${encodeURIComponent(storefrontThemeState.slug)}/cookies`;
      }

      return "/cookies";
    };

    if (!storefrontThemeState.isActive || !storefrontThemeState.slug) {
      return {
        isStorefront: false,
        cookiePolicyHref: resolveStoreCookiePolicyHref(),
        themeStyle: undefined,
        radiusClass: "",
        buttonRadiusClass: "",
        cardClass: "",
        pageWidthClass: "max-w-6xl",
        bannerPaddingClass: "px-4 py-4 sm:px-6",
        sectionSpacingClass: "space-y-6"
      };
    }

    const pageWidthClass =
      storefrontThemeState.pageWidth === "narrow" ||
      storefrontThemeState.pageWidth === "standard" ||
      storefrontThemeState.pageWidth === "wide"
        ? getStorefrontPageWidthClass(storefrontThemeState.pageWidth)
        : "max-w-6xl";

    const bannerPaddingClass =
      storefrontThemeState.spacingScale === "compact"
        ? "px-4 py-3 sm:px-6"
        : storefrontThemeState.spacingScale === "airy"
          ? "px-4 py-5 sm:px-6 sm:py-6"
          : "px-4 py-4 sm:px-6";

    const sectionSpacingClass =
      storefrontThemeState.spacingScale === "compact"
        ? "space-y-4"
        : storefrontThemeState.spacingScale === "airy"
          ? "space-y-8"
          : "space-y-6";

    return {
      isStorefront: true,
      cookiePolicyHref: resolveStoreCookiePolicyHref(),
      themeStyle: undefined,
      radiusClass:
        storefrontThemeState.radiusScale === "soft" ||
        storefrontThemeState.radiusScale === "rounded" ||
        storefrontThemeState.radiusScale === "sharp"
          ? getStorefrontRadiusClass(storefrontThemeState.radiusScale)
          : "",
      buttonRadiusClass:
        storefrontThemeState.radiusScale === "soft" ||
        storefrontThemeState.radiusScale === "rounded" ||
        storefrontThemeState.radiusScale === "sharp"
          ? getStorefrontButtonRadiusClass(storefrontThemeState.radiusScale)
          : "",
      cardClass:
        storefrontThemeState.cardStyle === "solid" ||
        storefrontThemeState.cardStyle === "outline" ||
        storefrontThemeState.cardStyle === "elevated" ||
        storefrontThemeState.cardStyle === "integrated"
          ? getStorefrontCardStyleClass(storefrontThemeState.cardStyle)
          : "",
      pageWidthClass,
      bannerPaddingClass,
      sectionSpacingClass
    };
  }, [storefrontThemeState]);
}
