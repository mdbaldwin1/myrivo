export const COOKIE_CONSENT_COOKIE_NAME = "myrivo_cookie_consent";
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export const COOKIE_CONSENT_CATEGORIES = ["essential", "analytics"] as const;
export type CookieConsentCategory = (typeof COOKIE_CONSENT_CATEGORIES)[number];

export type CookieStorageType = "cookie" | "local_storage";
export type CookieSurface = "platform_public" | "storefront" | "authenticated_dashboard";

export type CookieInventoryEntry = {
  key: string;
  name: string;
  provider: string;
  storageType: CookieStorageType;
  category: CookieConsentCategory;
  essential: boolean;
  duration: string;
  surfaces: CookieSurface[];
  purpose: string;
  owner: "platform";
};

export type CookieConsentRecord = {
  version: "v1";
  essential: true;
  analytics: boolean;
  hasRecordedChoice: boolean;
  updatedAt: string | null;
};

export const COOKIE_COMPLIANCE_INFORMATION_ARCHITECTURE = {
  platformOwns: [
    "cookie inventory and category definitions",
    "cookie policy copy and preferences UX",
    "consent persistence and analytics gating",
    "support/runbook guidance for cookie compliance"
  ],
  storefrontInherits: [
    "cookie banner and preferences center behavior",
    "cookie policy rendering with store-aware context when applicable",
    "consent gating for storefront analytics cookies and similar storage"
  ],
  storeDoesNotOwn: [
    "custom cookie category definitions",
    "analytics consent logic",
    "platform auth or workspace cookies"
  ]
} as const;

export const COOKIE_INVENTORY: readonly CookieInventoryEntry[] = [
  {
    key: "sb-access-token / sb-refresh-token",
    name: "Supabase authentication cookies",
    provider: "Myrivo / Supabase",
    storageType: "cookie",
    category: "essential",
    essential: true,
    duration: "Session and refresh-token lifetime",
    surfaces: ["platform_public", "authenticated_dashboard"],
    purpose: "Keep signed-in users authenticated and protect access to account and dashboard surfaces.",
    owner: "platform"
  },
  {
    key: "myrivo_active_store_slug",
    name: "Active store selection",
    provider: "Myrivo",
    storageType: "cookie",
    category: "essential",
    essential: true,
    duration: "30 days",
    surfaces: ["authenticated_dashboard"],
    purpose: "Remember which store workspace the user last selected in the dashboard.",
    owner: "platform"
  },
  {
    key: "myrivo_cookie_consent",
    name: "Cookie preferences",
    provider: "Myrivo",
    storageType: "cookie",
    category: "essential",
    essential: true,
    duration: "180 days",
    surfaces: ["platform_public", "storefront"],
    purpose: "Persist the shopper's cookie preferences and avoid asking on every visit.",
    owner: "platform"
  },
  {
    key: "myrivo_analytics_sid",
    name: "Storefront analytics session",
    provider: "Myrivo",
    storageType: "cookie",
    category: "analytics",
    essential: false,
    duration: "30 days",
    surfaces: ["storefront"],
    purpose: "Associate storefront browsing events with a shopper session for traffic and conversion analytics.",
    owner: "platform"
  },
  {
    key: "myrivo.analytics.session.<store-slug>",
    name: "Storefront analytics local session mirror",
    provider: "Myrivo",
    storageType: "local_storage",
    category: "analytics",
    essential: false,
    duration: "30 days",
    surfaces: ["storefront"],
    purpose: "Mirror the storefront analytics session in local storage so client-side analytics can reuse the same session key.",
    owner: "platform"
  }
] as const;

export function getDefaultCookieConsent(): CookieConsentRecord {
  return {
    version: "v1",
    essential: true,
    analytics: false,
    hasRecordedChoice: false,
    updatedAt: null
  };
}

export function createCookieConsentRecord(input: {
  analytics: boolean;
  hasRecordedChoice?: boolean;
  updatedAt?: string | null;
}): CookieConsentRecord {
  return {
    version: "v1",
    essential: true,
    analytics: input.analytics,
    hasRecordedChoice: input.hasRecordedChoice ?? true,
    updatedAt: input.updatedAt ?? new Date().toISOString()
  };
}

export function resolveCookieConsent(rawValue: string | null | undefined): CookieConsentRecord {
  if (!rawValue?.trim()) {
    return getDefaultCookieConsent();
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(rawValue)) as Partial<CookieConsentRecord> & { version?: string };
    if (parsed.version !== "v1") {
      return getDefaultCookieConsent();
    }

    return {
      version: "v1",
      essential: true,
      analytics: parsed.analytics === true,
      hasRecordedChoice: parsed.hasRecordedChoice === true,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null
    };
  } catch {
    return getDefaultCookieConsent();
  }
}

export function serializeCookieConsent(consent: CookieConsentRecord) {
  return encodeURIComponent(
    JSON.stringify({
      version: consent.version,
      essential: true,
      analytics: consent.analytics,
      hasRecordedChoice: consent.hasRecordedChoice,
      updatedAt: consent.updatedAt
    })
  );
}

export function hasAnalyticsConsent(consent: CookieConsentRecord) {
  return consent.analytics === true;
}

export function getCookieInventoryByCategory(category: CookieConsentCategory) {
  return COOKIE_INVENTORY.filter((entry) => entry.category === category);
}
