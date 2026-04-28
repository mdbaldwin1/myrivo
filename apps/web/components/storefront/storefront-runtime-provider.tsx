"use client";

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { StorefrontAnalyticsProvider } from "@/components/storefront/storefront-analytics-provider";
import { SurfacePortalProvider } from "@/components/ui/surface-portal-context";
import { StorefrontStoreAlert } from "@/components/storefront/storefront-store-alert";
import { StorefrontWelcomePopup } from "@/components/storefront/storefront-welcome-popup";
import type { StorefrontMode, StorefrontRuntime } from "@/lib/storefront/runtime";
import { buildStorefrontThemeStyle } from "@/lib/theme/storefront-theme";

const StorefrontRuntimeContext = createContext<StorefrontRuntime | null>(null);

type StorefrontRuntimeProviderProps = {
  runtime: StorefrontRuntime;
  children: ReactNode;
};

export function StorefrontRuntimeProvider({ runtime, children }: StorefrontRuntimeProviderProps) {
  const portalContainerRef = useRef<HTMLDivElement | null>(null);
  const themeStyle = useMemo(
    () =>
      buildStorefrontThemeStyle({
        primaryColor: runtime.branding?.primary_color,
        accentColor: runtime.branding?.accent_color,
        themeConfig: runtime.themeConfig
      }),
    [runtime.branding?.accent_color, runtime.branding?.primary_color, runtime.themeConfig]
  );

  const themeDataset = useMemo(
    () => ({
      "data-storefront-theme-active": "true" as const,
      "data-storefront-slug": runtime.store.slug,
      "data-storefront-radius-scale": runtime.themeConfig.radiusScale,
      "data-storefront-card-style": runtime.themeConfig.cardStyle,
      "data-storefront-page-width": runtime.themeConfig.pageWidth,
      "data-storefront-spacing-scale": runtime.themeConfig.spacingScale,
      "data-storefront-mode": runtime.mode satisfies StorefrontMode
    }),
    [runtime.mode, runtime.store.slug, runtime.themeConfig.cardStyle, runtime.themeConfig.pageWidth, runtime.themeConfig.radiusScale, runtime.themeConfig.spacingScale]
  );

  useEffect(() => {
    if (runtime.mode !== "live") {
      return;
    }

    const body = document.body;
    const previousSlug = body.dataset.storefrontSlug;
    const previousRadiusScale = body.dataset.storefrontRadiusScale;
    const previousCardStyle = body.dataset.storefrontCardStyle;
    const previousPageWidth = body.dataset.storefrontPageWidth;
    const previousSpacingScale = body.dataset.storefrontSpacingScale;
    const previousThemeFlag = body.dataset.storefrontThemeActive;
    const previousThemeEntries = Object.keys(themeStyle).map((key) => [key, body.style.getPropertyValue(key)] as const);

    body.dataset.storefrontSlug = runtime.store.slug;
    body.dataset.storefrontRadiusScale = runtime.themeConfig.radiusScale;
    body.dataset.storefrontCardStyle = runtime.themeConfig.cardStyle;
    body.dataset.storefrontPageWidth = runtime.themeConfig.pageWidth;
    body.dataset.storefrontSpacingScale = runtime.themeConfig.spacingScale;
    body.dataset.storefrontThemeActive = "true";

    for (const [key, value] of Object.entries(themeStyle)) {
      body.style.setProperty(key, String(value));
    }

    window.dispatchEvent(new Event("myrivo:storefront-theme-change"));

    return () => {
      if (previousSlug) {
        body.dataset.storefrontSlug = previousSlug;
      } else {
        delete body.dataset.storefrontSlug;
      }

      if (previousRadiusScale) {
        body.dataset.storefrontRadiusScale = previousRadiusScale;
      } else {
        delete body.dataset.storefrontRadiusScale;
      }

      if (previousCardStyle) {
        body.dataset.storefrontCardStyle = previousCardStyle;
      } else {
        delete body.dataset.storefrontCardStyle;
      }

      if (previousPageWidth) {
        body.dataset.storefrontPageWidth = previousPageWidth;
      } else {
        delete body.dataset.storefrontPageWidth;
      }

      if (previousSpacingScale) {
        body.dataset.storefrontSpacingScale = previousSpacingScale;
      } else {
        delete body.dataset.storefrontSpacingScale;
      }

      if (previousThemeFlag) {
        body.dataset.storefrontThemeActive = previousThemeFlag;
      } else {
        delete body.dataset.storefrontThemeActive;
      }

      for (const [key, previousValue] of previousThemeEntries) {
        if (previousValue) {
          body.style.setProperty(key, previousValue);
        } else {
          body.style.removeProperty(key);
        }
      }

      window.dispatchEvent(new Event("myrivo:storefront-theme-change"));
    };
  }, [runtime.mode, runtime.store.slug, runtime.themeConfig.cardStyle, runtime.themeConfig.pageWidth, runtime.themeConfig.radiusScale, runtime.themeConfig.spacingScale, themeStyle]);

  return (
    <StorefrontRuntimeContext.Provider value={runtime}>
      <SurfacePortalProvider value={{ portalContainerRef }}>
        <StorefrontAnalyticsProvider runtime={runtime}>
          <div className="relative h-full min-h-full" style={themeStyle} {...themeDataset}>
            {children}
            <div ref={portalContainerRef} data-storefront-portal-root="true" />
            <StorefrontWelcomePopup runtime={runtime} />
            <StorefrontStoreAlert runtime={runtime} />
          </div>
        </StorefrontAnalyticsProvider>
      </SurfacePortalProvider>
    </StorefrontRuntimeContext.Provider>
  );
}

export function useOptionalStorefrontRuntime() {
  return useContext(StorefrontRuntimeContext);
}

export function useStorefrontRuntime() {
  const runtime = useOptionalStorefrontRuntime();
  if (!runtime) {
    throw new Error("useStorefrontRuntime must be used within a StorefrontRuntimeProvider");
  }
  return runtime;
}

export function useStorefrontMode(): StorefrontMode {
  return useStorefrontRuntime().mode;
}
