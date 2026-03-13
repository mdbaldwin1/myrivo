import {
  sanitizeStorefrontAttributionTouch,
  sanitizeStorefrontSessionContext
} from "@/lib/analytics/governance";

const ATTRIBUTION_STORAGE_KEY_PREFIX = "myrivo.analytics.attribution.";

export type StorefrontAttributionTouch = {
  entryPath?: string;
  referrerUrl?: string;
  referrerHost?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
};

export type StorefrontAttributionSnapshot = {
  firstTouch?: StorefrontAttributionTouch;
  lastTouch?: StorefrontAttributionTouch;
};

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function pickTouchValue(touch: StorefrontAttributionTouch | undefined) {
  if (!touch) {
    return undefined;
  }

  return Object.fromEntries(Object.entries(touch).filter(([, value]) => Boolean(value))) as StorefrontAttributionTouch;
}

export function buildStorefrontAttributionTouch(input: {
  entryPath?: string | null;
  referrer?: string | null;
  storeSlug?: string;
}) {
  const sessionContext = sanitizeStorefrontSessionContext({
    entryPath: input.entryPath,
    referrer: input.referrer,
    storeSlug: input.storeSlug
  });
  const entryPath = sessionContext.entryPath;
  const referrerUrl = sessionContext.referrer;

  let utmSource: string | undefined;
  let utmMedium: string | undefined;
  let utmCampaign: string | undefined;
  let utmTerm: string | undefined;
  let utmContent: string | undefined;

  if (entryPath) {
    try {
      const parsed = new URL(entryPath, "https://myrivo.local");
      utmSource = parsed.searchParams.get("utm_source")?.trim() || undefined;
      utmMedium = parsed.searchParams.get("utm_medium")?.trim() || undefined;
      utmCampaign = parsed.searchParams.get("utm_campaign")?.trim() || undefined;
      utmTerm = parsed.searchParams.get("utm_term")?.trim() || undefined;
      utmContent = parsed.searchParams.get("utm_content")?.trim() || undefined;
    } catch {
      // Ignore malformed paths and fall back to whatever normalized.
    }
  }

  return sanitizeStorefrontAttributionTouch(
    pickTouchValue({
      entryPath,
      referrerUrl,
      referrerHost: undefined,
      utmSource,
      utmMedium,
      utmCampaign,
      utmTerm,
      utmContent
    }),
    input.storeSlug
  );
}

export function getStorefrontAttributionStorageKey(storeSlug: string) {
  return `${ATTRIBUTION_STORAGE_KEY_PREFIX}${storeSlug.trim().toLowerCase()}`;
}

export function readStorefrontAttributionSnapshot(storeSlug: string, storage?: StorageLike | null) {
  const resolvedStorage = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
  if (!resolvedStorage) {
    return null;
  }

  try {
    const raw = resolvedStorage.getItem(getStorefrontAttributionStorageKey(storeSlug));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StorefrontAttributionSnapshot;
    return {
      firstTouch: pickTouchValue(parsed.firstTouch),
      lastTouch: pickTouchValue(parsed.lastTouch)
    };
  } catch {
    return null;
  }
}

export function writeStorefrontAttributionSnapshot(storeSlug: string, snapshot: StorefrontAttributionSnapshot, storage?: StorageLike | null) {
  const resolvedStorage = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
  if (!resolvedStorage) {
    return;
  }

  resolvedStorage.setItem(getStorefrontAttributionStorageKey(storeSlug), JSON.stringify(snapshot));
}

function hasMarketingSignal(touch: StorefrontAttributionTouch | undefined) {
  if (!touch) {
    return false;
  }

  return Boolean(
    touch.referrerHost ||
      touch.utmSource ||
      touch.utmMedium ||
      touch.utmCampaign ||
      touch.utmTerm ||
      touch.utmContent
  );
}

export function mergeStorefrontAttributionSnapshot(
  existing: StorefrontAttributionSnapshot | null | undefined,
  incoming: StorefrontAttributionTouch | undefined
) {
  if (!incoming) {
    return existing ?? {};
  }

  const normalizedIncoming = pickTouchValue(incoming);
  if (!normalizedIncoming) {
    return existing ?? {};
  }

  const firstTouch = existing?.firstTouch ?? normalizedIncoming;
  const shouldUpdateLastTouch = !existing?.lastTouch || hasMarketingSignal(normalizedIncoming);

  return {
    firstTouch,
    lastTouch: shouldUpdateLastTouch ? normalizedIncoming : existing?.lastTouch ?? normalizedIncoming
  } satisfies StorefrontAttributionSnapshot;
}
