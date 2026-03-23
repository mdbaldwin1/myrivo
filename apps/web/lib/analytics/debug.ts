type AnalyticsDebugStorage = {
  getItem: (key: string) => string | null;
};

type AnalyticsDebugEvent = {
  phase: "track" | "flush_success" | "flush_failure" | "dropped";
  storeSlug: string;
  sessionId?: string | null;
  eventCount?: number;
  queuedCount?: number;
  eventType?: string;
  reason?: string;
};

const DEBUG_STORAGE_KEY = "myrivo.analytics.debug";

function normalizeDebugFlag(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "debug" || normalized === "analytics";
}

export function shouldEnableStorefrontAnalyticsDebug(input: {
  search?: string | null;
  storage?: AnalyticsDebugStorage | null;
}) {
  const params = new URLSearchParams(input.search ?? "");
  if (normalizeDebugFlag(params.get("analyticsDebug")) || normalizeDebugFlag(params.get("debugAnalytics"))) {
    return true;
  }

  return normalizeDebugFlag(input.storage?.getItem(DEBUG_STORAGE_KEY) ?? null);
}

export function emitStorefrontAnalyticsDebugEvent(debugEvent: AnalyticsDebugEvent) {
  if (typeof window === "undefined") {
    return;
  }

  const target = window as Window & {
    __MYRIVO_ANALYTICS_DEBUG__?: Array<AnalyticsDebugEvent & { timestamp: string }>;
  };

  const entry = {
    ...debugEvent,
    timestamp: new Date().toISOString()
  };

  const existing = target.__MYRIVO_ANALYTICS_DEBUG__ ?? [];
  target.__MYRIVO_ANALYTICS_DEBUG__ = [...existing.slice(-49), entry];
  window.dispatchEvent(new CustomEvent("myrivo:analytics-debug", { detail: entry }));
  console.info("[myrivo analytics]", entry);
}

export function getStorefrontAnalyticsDebugStorage(storage?: AnalyticsDebugStorage | null) {
  if (storage !== undefined) {
    return storage;
  }

  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

