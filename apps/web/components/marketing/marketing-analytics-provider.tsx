"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { usePathname } from "next/navigation";
import { useOptionalCookieConsent } from "@/components/privacy/cookie-consent-provider";
import {
  MARKETING_ANALYTICS_COOKIE_NAME,
  MARKETING_ANALYTICS_SESSION_STORAGE_KEY,
  type MarketingExperimentAssignments,
  type MarketingPageKey
} from "@/lib/marketing/analytics";
import { resolveMarketingExperimentAssignments } from "@/lib/marketing/experiments";
import { resolveMarketingPageKey } from "@/lib/marketing/site-map";

type MarketingAnalyticsContextValue = {
  pageKey: MarketingPageKey | null;
  experimentAssignments: MarketingExperimentAssignments;
  track: (input: {
    eventType: "cta_click" | "pricing_interaction" | "signup_started" | "signup_completed" | "demo_request_started";
    sectionKey?: string;
    ctaKey?: string;
    ctaLabel?: string;
    value?: Record<string, unknown>;
  }) => void;
};

const MarketingAnalyticsContext = createContext<MarketingAnalyticsContextValue | null>(null);

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replaceAll("-", "");
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function readSessionKey() {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(MARKETING_ANALYTICS_SESSION_STORAGE_KEY);
  if (stored?.trim()) {
    return stored;
  }

  const cookieEntry = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${MARKETING_ANALYTICS_COOKIE_NAME}=`));
  return cookieEntry?.slice(`${MARKETING_ANALYTICS_COOKIE_NAME}=`.length) ?? null;
}

function writeSessionKey(sessionKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(MARKETING_ANALYTICS_SESSION_STORAGE_KEY, sessionKey);
}

function clearSessionKey() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(MARKETING_ANALYTICS_SESSION_STORAGE_KEY);
  document.cookie = `${MARKETING_ANALYTICS_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax${
    window.location.protocol === "https:" ? "; Secure" : ""
  }`;
}

type MarketingAnalyticsProviderProps = {
  children: ReactNode;
};

export function MarketingAnalyticsProvider({ children }: MarketingAnalyticsProviderProps) {
  const pathname = usePathname();
  const cookieConsent = useOptionalCookieConsent();
  const analyticsEnabled = cookieConsent?.analyticsEnabled ?? false;
  const pageKey = pathname ? resolveMarketingPageKey(pathname) : null;
  const [sessionKey] = useState<string | null>(() => readSessionKey() ?? createId());
  const lastTrackedPathRef = useRef<string | null>(null);

  const experimentAssignments = useMemo(
    () =>
      analyticsEnabled && pageKey && sessionKey
        ? resolveMarketingExperimentAssignments({
            pageKey,
            sessionKey
          })
        : {},
    [analyticsEnabled, pageKey, sessionKey]
  );

  useEffect(() => {
    if (!analyticsEnabled) {
      lastTrackedPathRef.current = null;
      clearSessionKey();
      return;
    }
  }, [analyticsEnabled]);

  useEffect(() => {
    if (!analyticsEnabled || !sessionKey) {
      return;
    }

    writeSessionKey(sessionKey);
  }, [analyticsEnabled, sessionKey]);

  useEffect(() => {
    if (!analyticsEnabled || !pageKey || !pathname || !sessionKey) {
      return;
    }

    const search = typeof window !== "undefined" ? window.location.search : "";
    const path = `${pathname}${search}`;
    if (lastTrackedPathRef.current === path) {
      return;
    }
    lastTrackedPathRef.current = path;

    void fetch("/api/marketing/analytics/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionKey,
        entryPath: path,
        referrer: typeof document !== "undefined" ? document.referrer : undefined,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        events: [
          {
            eventType: "page_view",
            path,
            pageKey,
            experimentAssignments
          }
        ]
      }),
      keepalive: true
    });
  }, [analyticsEnabled, experimentAssignments, pageKey, pathname, sessionKey]);

  const value = useMemo<MarketingAnalyticsContextValue>(
    () => ({
      pageKey,
      experimentAssignments,
      track: (input) => {
        if (!analyticsEnabled || !pathname || !sessionKey) {
          return;
        }

        const search = typeof window !== "undefined" ? window.location.search : "";
        const path = `${pathname}${search}`;
        void fetch("/api/marketing/analytics/collect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionKey,
            entryPath: path,
            referrer: typeof document !== "undefined" ? document.referrer : undefined,
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
            events: [
              {
                eventType: input.eventType,
                path,
                pageKey: pageKey ?? undefined,
                sectionKey: input.sectionKey,
                ctaKey: input.ctaKey,
                ctaLabel: input.ctaLabel,
                value: input.value,
                experimentAssignments
              }
            ]
          }),
          keepalive: true
        });
      }
    }),
    [analyticsEnabled, experimentAssignments, pageKey, pathname, sessionKey]
  );

  return <MarketingAnalyticsContext.Provider value={value}>{children}</MarketingAnalyticsContext.Provider>;
}

export function useMarketingAnalytics() {
  const context = useContext(MarketingAnalyticsContext);
  if (!context) {
    throw new Error("useMarketingAnalytics must be used within a MarketingAnalyticsProvider");
  }
  return context;
}
