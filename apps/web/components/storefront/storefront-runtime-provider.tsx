"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { StorefrontAnalyticsProvider } from "@/components/storefront/storefront-analytics-provider";
import { StorefrontWelcomePopup } from "@/components/storefront/storefront-welcome-popup";
import type { StorefrontMode, StorefrontRuntime } from "@/lib/storefront/runtime";
import { buildStorefrontThemeStyle } from "@/lib/theme/storefront-theme";

const StorefrontRuntimeContext = createContext<StorefrontRuntime | null>(null);

type StorefrontRuntimeProviderProps = {
  runtime: StorefrontRuntime;
  children: ReactNode;
};

export function StorefrontRuntimeProvider({ runtime, children }: StorefrontRuntimeProviderProps) {
  useEffect(() => {
    const body = document.body;
    const previousSlug = body.dataset.storefrontSlug;
    const previousRadiusScale = body.dataset.storefrontRadiusScale;
    const previousCardStyle = body.dataset.storefrontCardStyle;
    const previousPageWidth = body.dataset.storefrontPageWidth;
    const previousSpacingScale = body.dataset.storefrontSpacingScale;
    const previousThemeFlag = body.dataset.storefrontThemeActive;
    const themeStyle = buildStorefrontThemeStyle({
      primaryColor: runtime.branding?.primary_color,
      accentColor: runtime.branding?.accent_color,
      themeConfig: runtime.themeConfig
    });
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
  }, [runtime]);

  return (
    <StorefrontRuntimeContext.Provider value={runtime}>
      <StorefrontAnalyticsProvider runtime={runtime}>
        <div className="relative h-full min-h-full">
          {children}
          <StorefrontWelcomePopup runtime={runtime} />
        </div>
      </StorefrontAnalyticsProvider>
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
