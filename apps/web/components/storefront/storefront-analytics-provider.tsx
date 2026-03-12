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
        enabled: runtime.mode === "live"
      }),
    [runtime.mode, runtime.store.slug]
  );

  useEffect(() => {
    analytics.start();
    return () => analytics.stop();
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
