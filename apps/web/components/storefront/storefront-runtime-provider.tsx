"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { StorefrontAnalyticsProvider } from "@/components/storefront/storefront-analytics-provider";
import { buildStorefrontThemeStyle } from "@/lib/theme/storefront-theme";
import type { StorefrontMode, StorefrontRuntime } from "@/lib/storefront/runtime";

const StorefrontRuntimeContext = createContext<StorefrontRuntime | null>(null);

type StorefrontRuntimeProviderProps = {
  runtime: StorefrontRuntime;
  children: ReactNode;
};

export function StorefrontRuntimeProvider({ runtime, children }: StorefrontRuntimeProviderProps) {
  useEffect(() => {
    if (runtime.mode !== "live" || typeof document === "undefined") {
      return;
    }

    const body = document.body;
    const themeStyle = buildStorefrontThemeStyle({
      primaryColor: runtime.branding?.primary_color,
      accentColor: runtime.branding?.accent_color,
      themeConfig: runtime.themeConfig
    });
    const previousThemeMarker = body.dataset.cookieTheme;
    const previousRadiusScale = body.dataset.storefrontRadiusScale;
    const previousCardStyle = body.dataset.storefrontCardStyle;
    const previousValues = Object.entries(themeStyle).map(([key]) => [key, body.style.getPropertyValue(key)] as const);

    body.dataset.cookieTheme = "storefront";
    body.dataset.storefrontRadiusScale = runtime.themeConfig.radiusScale;
    body.dataset.storefrontCardStyle = runtime.themeConfig.cardStyle;

    for (const [key, value] of Object.entries(themeStyle)) {
      body.style.setProperty(key, String(value));
    }

    return () => {
      if (previousThemeMarker) {
        body.dataset.cookieTheme = previousThemeMarker;
      } else {
        delete body.dataset.cookieTheme;
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

      for (const [key, previousValue] of previousValues) {
        if (previousValue) {
          body.style.setProperty(key, previousValue);
        } else {
          body.style.removeProperty(key);
        }
      }
    };
  }, [runtime]);

  return (
    <StorefrontRuntimeContext.Provider value={runtime}>
      <StorefrontAnalyticsProvider runtime={runtime}>{children}</StorefrontAnalyticsProvider>
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
