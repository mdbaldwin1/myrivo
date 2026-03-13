"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { createStorefrontAnalyticsClient, type StorefrontAnalyticsClient } from "@/lib/analytics/client";
import type { StorefrontRuntime } from "@/lib/storefront/runtime";

const StorefrontAnalyticsContext = createContext<StorefrontAnalyticsClient | null>(null);

type StorefrontAnalyticsProviderProps = {
  runtime: StorefrontRuntime;
  children: ReactNode;
};

export function StorefrontAnalyticsProvider({ runtime, children }: StorefrontAnalyticsProviderProps) {
  const analytics = useMemo(
    () =>
      createStorefrontAnalyticsClient({
        storeSlug: runtime.store.slug,
        enabled: runtime.mode === "live" && runtime.analytics.collectionEnabled
      }),
    [runtime.analytics.collectionEnabled, runtime.mode, runtime.store.slug]
  );

  useEffect(() => {
    analytics.start();
    return () => analytics.stop();
  }, [analytics]);

  useEffect(() => {
    if (typeof window === "undefined" || !analytics.isDebugEnabled()) {
      return;
    }

    const target = window as Window & {
      __MYRIVO_ANALYTICS_CLIENT__?: StorefrontAnalyticsClient;
    };
    target.__MYRIVO_ANALYTICS_CLIENT__ = analytics;

    return () => {
      if (target.__MYRIVO_ANALYTICS_CLIENT__ === analytics) {
        delete target.__MYRIVO_ANALYTICS_CLIENT__;
      }
    };
  }, [analytics]);

  return <StorefrontAnalyticsContext.Provider value={analytics}>{children}</StorefrontAnalyticsContext.Provider>;
}

export function useOptionalStorefrontAnalytics() {
  return useContext(StorefrontAnalyticsContext);
}

export function useStorefrontAnalytics() {
  const analytics = useOptionalStorefrontAnalytics();
  if (!analytics) {
    throw new Error("useStorefrontAnalytics must be used within a StorefrontAnalyticsProvider");
  }
  return analytics;
}
