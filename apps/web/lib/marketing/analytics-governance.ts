import type { CollectMarketingAnalyticsEvent, MarketingExperimentAssignments } from "@/lib/marketing/analytics";

const MARKETING_QUERY_PARAMS = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]);

function normalizeString(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  return normalized.slice(0, maxLength);
}

function normalizeInteger(value: unknown, options: { min?: number; max?: number } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const normalized = Math.trunc(value);
  if (options.min !== undefined && normalized < options.min) {
    return undefined;
  }
  if (options.max !== undefined && normalized > options.max) {
    return undefined;
  }

  return normalized;
}

function compactObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

export function sanitizeMarketingPath(input: string | null | undefined) {
  const normalized = normalizeString(input, 512);
  if (!normalized) {
    return undefined;
  }

  try {
    const parsed = normalized.startsWith("/") ? new URL(normalized, "https://myrivo.local") : new URL(normalized);
    const query = new URLSearchParams();
    for (const [key, value] of parsed.searchParams.entries()) {
      if (!MARKETING_QUERY_PARAMS.has(key)) {
        continue;
      }
      const safeValue = normalizeString(value, 255);
      if (safeValue) {
        query.set(key, safeValue);
      }
    }

    const search = query.toString();
    return `${parsed.pathname}${search ? `?${search}` : ""}`;
  } catch {
    return normalized.startsWith("/") ? normalized : undefined;
  }
}

export function sanitizeMarketingReferrer(input: string | null | undefined) {
  const normalized = normalizeString(input, 1024);
  if (!normalized) {
    return undefined;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.hostname === "localhost") {
      return undefined;
    }
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return undefined;
  }
}

export function sanitizeMarketingReferrerHost(input: string | null | undefined) {
  if (!input) {
    return undefined;
  }

  try {
    return new URL(input).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

export function sanitizeMarketingExperimentAssignments(assignments: MarketingExperimentAssignments | null | undefined) {
  if (!assignments) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(assignments).flatMap(([key, value]) => {
      const normalizedKey = normalizeString(key, 80);
      const normalizedValue = normalizeString(value, 80);
      return normalizedKey && normalizedValue ? [[normalizedKey, normalizedValue]] : [];
    })
  );
}

export function sanitizeMarketingEventValue(event: CollectMarketingAnalyticsEvent) {
  const value = event.value ?? {};

  if (event.eventType === "cta_click") {
    return compactObject({
      destination: normalizeString(value.destination, 255),
      surface: normalizeString(value.surface, 64)
    });
  }

  if (event.eventType === "pricing_interaction") {
    return compactObject({
      action: normalizeString(value.action, 64),
      planKey: normalizeString(value.planKey, 64),
      position: normalizeInteger(value.position, { min: 0, max: 50 })
    });
  }

  if (event.eventType === "signup_started" || event.eventType === "signup_completed") {
    return compactObject({
      source: normalizeString(value.source, 120)
    });
  }

  if (event.eventType === "demo_request_started") {
    return compactObject({
      channel: normalizeString(value.channel, 64)
    });
  }

  return {};
}

export function extractMarketingUtmFields(path: string | undefined) {
  if (!path) {
    return {};
  }

  try {
    const parsed = new URL(path, "https://myrivo.local");
    return compactObject({
      utmSource: normalizeString(parsed.searchParams.get("utm_source"), 255),
      utmMedium: normalizeString(parsed.searchParams.get("utm_medium"), 255),
      utmCampaign: normalizeString(parsed.searchParams.get("utm_campaign"), 255),
      utmTerm: normalizeString(parsed.searchParams.get("utm_term"), 255),
      utmContent: normalizeString(parsed.searchParams.get("utm_content"), 255)
    });
  } catch {
    return {};
  }
}
