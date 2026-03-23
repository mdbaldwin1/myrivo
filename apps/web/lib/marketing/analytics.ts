import { z } from "zod";

export const marketingAnalyticsEventTypes = [
  "page_view",
  "cta_click",
  "pricing_interaction",
  "signup_started",
  "signup_completed",
  "demo_request_started"
] as const;

export const MARKETING_ANALYTICS_SESSION_STORAGE_KEY = "myrivo.marketing.session";
export const MARKETING_ANALYTICS_COOKIE_NAME = "myrivo_marketing_sid";

export type MarketingAnalyticsEventType = (typeof marketingAnalyticsEventTypes)[number];

export const marketingPageKeys = [
  "home",
  "features",
  "pricing",
  "compare",
  "solutions",
  "solutions_handmade_products",
  "solutions_local_pickup_orders",
  "solutions_multi_store_commerce"
] as const;

export type MarketingPageKey = (typeof marketingPageKeys)[number];

export type MarketingExperimentAssignments = Record<string, string>;

export const marketingAnalyticsEventSchema = z.object({
  eventType: z.enum(marketingAnalyticsEventTypes),
  path: z.string().trim().max(512).optional(),
  pageKey: z.string().trim().max(120).optional(),
  sectionKey: z.string().trim().max(120).optional(),
  ctaKey: z.string().trim().max(120).optional(),
  ctaLabel: z.string().trim().max(160).optional(),
  value: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().trim().max(120).optional(),
  experimentAssignments: z.record(z.string(), z.string()).optional()
});

export type CollectMarketingAnalyticsEvent = z.infer<typeof marketingAnalyticsEventSchema>;

export const collectMarketingAnalyticsRequestSchema = z.object({
  sessionKey: z.string().trim().max(120).optional(),
  entryPath: z.string().trim().max(512).optional(),
  referrer: z.string().trim().max(1024).optional(),
  userAgent: z.string().trim().max(512).optional(),
  events: z.array(marketingAnalyticsEventSchema).min(1).max(20)
});

export type CollectMarketingAnalyticsRequest = z.infer<typeof collectMarketingAnalyticsRequestSchema>;

export function sanitizeMarketingSessionKey(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, 120);
}

export function isMarketingPageKey(value: string | null | undefined): value is MarketingPageKey {
  return typeof value === "string" && (marketingPageKeys as readonly string[]).includes(value);
}
