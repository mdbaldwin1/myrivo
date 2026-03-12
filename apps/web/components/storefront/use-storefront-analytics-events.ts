"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useOptionalStorefrontAnalytics } from "@/components/storefront/storefront-analytics-provider";
import { buildStorefrontSearchAnalyticsValue, buildStorefrontSearchSignature, normalizeStorefrontSearchQuery } from "@/lib/analytics/storefront-instrumentation";

type PageViewValue = Record<string, string | number | boolean | null | string[]>;

export function useStorefrontPageView(pageType: string, value?: PageViewValue) {
  const analytics = useOptionalStorefrontAnalytics();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";
  const valueSignature = JSON.stringify(value ?? {});
  const hasValue = valueSignature !== "{}";

  useEffect(() => {
    if (!analytics) {
      return;
    }

    analytics.track({
      eventType: "page_view",
      value: {
        pageType,
        ...(hasValue ? JSON.parse(valueSignature) : {})
      }
    });
  }, [analytics, hasValue, pageType, pathname, search, valueSignature]);
}

export function useStorefrontProductView(productId: string, value?: PageViewValue) {
  const analytics = useOptionalStorefrontAnalytics();
  const valueSignature = JSON.stringify(value ?? {});
  const hasValue = valueSignature !== "{}";

  useEffect(() => {
    if (!analytics || !productId) {
      return;
    }

    analytics.track({
      eventType: "product_view",
      productId,
      value: hasValue ? JSON.parse(valueSignature) : undefined
    });
  }, [analytics, hasValue, productId, valueSignature]);
}

export function useStorefrontSearchAnalytics(input: {
  query: string;
  resultCount: number;
  sortMode?: string;
  availabilityFilter?: string;
  selectedFilterValuesByAxis?: Record<string, string[]>;
  view: "home" | "products";
  enabled?: boolean;
  delayMs?: number;
}) {
  const analytics = useOptionalStorefrontAnalytics();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";
  const lastTrackedSignatureRef = useRef<string | null>(null);
  const delayMs = input.delayMs ?? 450;
  const query = input.query;
  const resultCount = input.resultCount;
  const sortMode = input.sortMode;
  const availabilityFilter = input.availabilityFilter;
  const selectedFilterValuesByAxis = input.selectedFilterValuesByAxis;
  const view = input.view;
  const enabled = input.enabled;

  useEffect(() => {
    if (!analytics || enabled === false) {
      return;
    }

    const normalizedQuery = normalizeStorefrontSearchQuery(query);
    if (!normalizedQuery) {
      return;
    }

    const trackingInput = {
      query,
      resultCount,
      sortMode,
      availabilityFilter,
      selectedFilterValuesByAxis,
      view
    } as const;
    const value = buildStorefrontSearchAnalyticsValue(trackingInput);
    const signature = `${pathname}?${search}:${buildStorefrontSearchSignature(trackingInput)}`;
    if (lastTrackedSignatureRef.current === signature) {
      return;
    }

    const timeout = window.setTimeout(() => {
      analytics.track({
        eventType: "search_performed",
        value
      });
      lastTrackedSignatureRef.current = signature;
    }, delayMs);

    return () => window.clearTimeout(timeout);
  }, [
    availabilityFilter,
    analytics,
    delayMs,
    enabled,
    pathname,
    query,
    resultCount,
    search,
    selectedFilterValuesByAxis,
    sortMode,
    view
  ]);
}
