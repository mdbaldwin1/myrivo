"use client";

import { createContext, useContext, type ReactNode } from "react";
import { StorefrontAnalyticsProvider } from "@/components/storefront/storefront-analytics-provider";
import type { StorefrontMode, StorefrontRuntime } from "@/lib/storefront/runtime";

const StorefrontRuntimeContext = createContext<StorefrontRuntime | null>(null);

type StorefrontRuntimeProviderProps = {
  runtime: StorefrontRuntime;
  children: ReactNode;
};

export function StorefrontRuntimeProvider({ runtime, children }: StorefrontRuntimeProviderProps) {
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
