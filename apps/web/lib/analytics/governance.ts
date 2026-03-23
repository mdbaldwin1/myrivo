import type { CollectAnalyticsEvent } from "@/lib/analytics/collect";
import type { StorefrontAttributionSnapshot, StorefrontAttributionTouch } from "@/lib/analytics/attribution";

const MARKETING_QUERY_PARAMS = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]);
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /\+?\d[\d\s().-]{6,}\d/;

type AnalyticsGovernanceRule = {
  allowedValueKeys: string[];
  notes: string;
};

export const storefrontAnalyticsGovernancePolicy: Record<CollectAnalyticsEvent["eventType"], AnalyticsGovernanceRule> = {
  page_view: {
    allowedValueKeys: [],
    notes: "Page views persist route-level context only; free-form payload values are dropped."
  },
  product_view: {
    allowedValueKeys: [],
    notes: "Product detail views rely on top-level product identifiers, not arbitrary payload values."
  },
  add_to_cart: {
    allowedValueKeys: ["quantity", "unitPriceCents", "source"],
    notes: "Cart intent keeps quantity, price, and source context while dropping variant IDs and extra metadata."
  },
  cart_view: {
    allowedValueKeys: ["itemCount", "subtotalCents", "shippingCents", "discountCents", "totalCents", "fulfillmentMethod"],
    notes: "Cart views keep only aggregate order-value metrics and fulfillment selection."
  },
  checkout_started: {
    allowedValueKeys: ["itemCount", "subtotalCents", "shippingCents", "discountCents", "totalCents", "fulfillmentMethod"],
    notes: "Checkout start events keep aggregate value metrics; product-level arrays are dropped."
  },
  checkout_completed: {
    allowedValueKeys: ["itemCount", "subtotalCents", "shippingCents", "discountCents", "totalCents", "fulfillmentMethod"],
    notes: "Checkout completion persists aggregate order metrics only; personal checkout inputs are never stored."
  },
  newsletter_subscribed: {
    allowedValueKeys: ["placement"],
    notes: "Newsletter events only keep placement metadata to avoid persisting subscriber-provided values."
  },
  search_performed: {
    allowedValueKeys: ["query", "resultCount", "view"],
    notes: "Search analytics keep a sanitized query only when it does not resemble PII."
  }
};

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

function sanitizeEntryPathValue(input: string | null | undefined) {
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

function sanitizeReferrerValue(input: string | null | undefined, storeSlug?: string) {
  const normalized = normalizeString(input, 1024);
  if (!normalized) {
    return undefined;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.hostname === "localhost") {
      return undefined;
    }
    if (storeSlug && parsed.pathname.startsWith(`/s/${storeSlug}`)) {
      return undefined;
    }
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return undefined;
  }
}

function sanitizeReferrerHostValue(referrerUrl: string | undefined) {
  if (!referrerUrl) {
    return undefined;
  }

  try {
    return new URL(referrerUrl).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function sanitizeSearchQuery(value: unknown) {
  const normalized = normalizeString(value, 80)?.toLowerCase().replace(/\s+/g, " ");
  if (!normalized) {
    return undefined;
  }

  if (EMAIL_PATTERN.test(normalized) || PHONE_PATTERN.test(normalized)) {
    return undefined;
  }

  return normalized;
}

function sanitizeFulfillmentMethod(value: unknown) {
  return value === "pickup" || value === "shipping" ? value : undefined;
}

function sanitizeSource(value: unknown) {
  return value === "home" || value === "products" || value === "product_detail" ? value : undefined;
}

function sanitizeView(value: unknown) {
  return value === "home" || value === "products" ? value : undefined;
}

function compactObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

export function sanitizeStorefrontAttributionTouch(
  touch: StorefrontAttributionTouch | null | undefined,
  storeSlug?: string
): StorefrontAttributionTouch | undefined {
  if (!touch) {
    return undefined;
  }

  const referrerUrl = sanitizeReferrerValue(touch.referrerUrl, storeSlug);
  const sanitized = compactObject({
    entryPath: sanitizeEntryPathValue(touch.entryPath),
    referrerUrl,
    referrerHost: sanitizeReferrerHostValue(referrerUrl),
    utmSource: normalizeString(touch.utmSource, 255),
    utmMedium: normalizeString(touch.utmMedium, 255),
    utmCampaign: normalizeString(touch.utmCampaign, 255),
    utmTerm: normalizeString(touch.utmTerm, 255),
    utmContent: normalizeString(touch.utmContent, 255)
  });

  return Object.keys(sanitized).length > 0 ? (sanitized as StorefrontAttributionTouch) : undefined;
}

export function sanitizeStorefrontAttributionSnapshot(
  snapshot: StorefrontAttributionSnapshot | null | undefined,
  storeSlug?: string
): StorefrontAttributionSnapshot | undefined {
  if (!snapshot) {
    return undefined;
  }

  const firstTouch = sanitizeStorefrontAttributionTouch(snapshot.firstTouch, storeSlug);
  const lastTouch = sanitizeStorefrontAttributionTouch(snapshot.lastTouch, storeSlug);
  if (!firstTouch && !lastTouch) {
    return undefined;
  }

  return compactObject({
    firstTouch,
    lastTouch
  }) as StorefrontAttributionSnapshot;
}

export function sanitizeStorefrontSessionContext(input: {
  entryPath?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  storeSlug?: string;
}) {
  return {
    entryPath: sanitizeEntryPathValue(input.entryPath),
    referrer: sanitizeReferrerValue(input.referrer, input.storeSlug),
    userAgent: normalizeString(input.userAgent, 512)
  };
}

export function sanitizeStorefrontAnalyticsEventValue(event: CollectAnalyticsEvent) {
  const value = event.value ?? {};

  if (event.eventType === "add_to_cart") {
    return compactObject({
      quantity: normalizeInteger(value.quantity, { min: 1, max: 999 }),
      unitPriceCents: normalizeInteger(value.unitPriceCents, { min: 0, max: 10_000_000 }),
      source: sanitizeSource(value.source)
    });
  }

  if (event.eventType === "cart_view" || event.eventType === "checkout_started" || event.eventType === "checkout_completed") {
    return compactObject({
      itemCount: normalizeInteger(value.itemCount, { min: 0, max: 999 }),
      subtotalCents: normalizeInteger(value.subtotalCents, { min: 0, max: 10_000_000 }),
      shippingCents: normalizeInteger(value.shippingCents, { min: 0, max: 10_000_000 }),
      discountCents: normalizeInteger(value.discountCents, { min: 0, max: 10_000_000 }),
      totalCents: normalizeInteger(value.totalCents, { min: 0, max: 10_000_000 }),
      fulfillmentMethod: sanitizeFulfillmentMethod(value.fulfillmentMethod)
    });
  }

  if (event.eventType === "newsletter_subscribed") {
    return compactObject({
      placement: normalizeString(value.placement, 64)
    });
  }

  if (event.eventType === "search_performed") {
    const query = sanitizeSearchQuery(value.query);
    return compactObject({
      query,
      resultCount: normalizeInteger(value.resultCount, { min: 0, max: 10_000 }),
      view: sanitizeView(value.view),
      queryRedacted: query ? undefined : value.query ? true : undefined
    });
  }

  return {};
}
