import type { CollectAnalyticsEvent } from "@/lib/analytics/collect";
import {
  buildStorefrontAttributionTouch,
  mergeStorefrontAttributionSnapshot,
  readStorefrontAttributionSnapshot,
  writeStorefrontAttributionSnapshot,
  type StorefrontAttributionSnapshot
} from "@/lib/analytics/attribution";
import { sanitizeSessionId, storefrontEventTypes } from "@/lib/analytics/collect";
import { emitStorefrontAnalyticsDebugEvent, getStorefrontAnalyticsDebugStorage, shouldEnableStorefrontAnalyticsDebug } from "@/lib/analytics/debug";

type StorefrontAnalyticsEventType = (typeof storefrontEventTypes)[number];

type StorefrontAnalyticsQueuedEvent = CollectAnalyticsEvent & {
  idempotencyKey: string;
};

type StorefrontAnalyticsResponse = {
  ok: boolean;
  sessionId?: string;
};

type StorefrontAnalyticsTransport = (payload: {
  storeSlug: string;
  sessionId: string;
  entryPath?: string;
  referrer?: string;
  userAgent?: string;
  attribution?: StorefrontAttributionSnapshot;
  events: StorefrontAnalyticsQueuedEvent[];
}, options?: { keepalive?: boolean }) => Promise<StorefrontAnalyticsResponse>;

type StorefrontAnalyticsStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

type StorefrontAnalyticsClientOptions = {
  storeSlug: string;
  enabled?: boolean;
  flushIntervalMs?: number;
  maxBatchSize?: number;
  maxRetries?: number;
  storage?: StorefrontAnalyticsStorage | null;
  transport?: StorefrontAnalyticsTransport;
  scheduleTimeout?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearScheduledTimeout?: (handle: ReturnType<typeof setTimeout>) => void;
  generateId?: () => string;
  getEntryPath?: () => string | undefined;
  getUserAgent?: () => string | undefined;
  getReferrer?: () => string | undefined;
  addWindowListener?: (type: string, listener: EventListener) => void;
  removeWindowListener?: (type: string, listener: EventListener) => void;
  addDocumentListener?: (type: string, listener: EventListener) => void;
  removeDocumentListener?: (type: string, listener: EventListener) => void;
  getDocumentVisibilityState?: () => DocumentVisibilityState | undefined;
  debug?: boolean;
  getSearch?: () => string | undefined;
};

type TrackStorefrontAnalyticsEventInput = Omit<CollectAnalyticsEvent, "idempotencyKey"> & {
  eventType: StorefrontAnalyticsEventType;
};

const DEFAULT_FLUSH_INTERVAL_MS = 1_000;
const DEFAULT_MAX_BATCH_SIZE = 20;
const DEFAULT_MAX_RETRIES = 3;
export const STOREFRONT_ANALYTICS_SESSION_COOKIE_NAME = "myrivo_analytics_sid";
export const STOREFRONT_ANALYTICS_SESSION_STORAGE_KEY_PREFIX = "myrivo.analytics.session.";

function defaultGenerateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replaceAll("-", "");
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function buildStorageKey(storeSlug: string) {
  return `${STOREFRONT_ANALYTICS_SESSION_STORAGE_KEY_PREFIX}${storeSlug}`;
}

function createDefaultStorage(): StorefrontAnalyticsStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return {
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value)
  };
}

function createDefaultTransport(): StorefrontAnalyticsTransport {
  return async (payload, options) => {
    const response = await fetch("/api/analytics/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: options?.keepalive ?? false
    });

    if (!response.ok) {
      return { ok: false };
    }

    const parsed = (await response.json()) as { ok?: boolean; sessionId?: string };
    return {
      ok: parsed.ok === true,
      sessionId: parsed.sessionId
    };
  };
}

function normalizePath(path: string | undefined | null) {
  if (!path) {
    return undefined;
  }

  const normalized = path.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function canUseBrowserAnalytics(enabled: boolean, storage: StorefrontAnalyticsStorage | null) {
  return enabled && Boolean(storage);
}

export function clearStorefrontAnalyticsPersistence(storeSlug?: string) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedStoreSlug = storeSlug?.trim().toLowerCase();
  if (normalizedStoreSlug) {
    window.localStorage.removeItem(buildStorageKey(normalizedStoreSlug));
  } else {
    const keysToRemove = Object.keys(window.localStorage).filter((key) =>
      key.startsWith(STOREFRONT_ANALYTICS_SESSION_STORAGE_KEY_PREFIX)
    );
    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  }

  document.cookie = `${STOREFRONT_ANALYTICS_SESSION_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax${
    window.location.protocol === "https:" ? "; Secure" : ""
  }`;
}

export class StorefrontAnalyticsClient {
  private readonly storeSlug: string;
  private readonly enabled: boolean;
  private readonly flushIntervalMs: number;
  private readonly maxBatchSize: number;
  private readonly maxRetries: number;
  private readonly storage: StorefrontAnalyticsStorage | null;
  private readonly transport: StorefrontAnalyticsTransport;
  private readonly scheduleTimeout: NonNullable<StorefrontAnalyticsClientOptions["scheduleTimeout"]>;
  private readonly clearScheduledTimeout: NonNullable<StorefrontAnalyticsClientOptions["clearScheduledTimeout"]>;
  private readonly generateId: NonNullable<StorefrontAnalyticsClientOptions["generateId"]>;
  private readonly getEntryPath: NonNullable<StorefrontAnalyticsClientOptions["getEntryPath"]>;
  private readonly getUserAgent: NonNullable<StorefrontAnalyticsClientOptions["getUserAgent"]>;
  private readonly getReferrer: NonNullable<StorefrontAnalyticsClientOptions["getReferrer"]>;
  private readonly addWindowListener: NonNullable<StorefrontAnalyticsClientOptions["addWindowListener"]>;
  private readonly removeWindowListener: NonNullable<StorefrontAnalyticsClientOptions["removeWindowListener"]>;
  private readonly addDocumentListener: NonNullable<StorefrontAnalyticsClientOptions["addDocumentListener"]>;
  private readonly removeDocumentListener: NonNullable<StorefrontAnalyticsClientOptions["removeDocumentListener"]>;
  private readonly getDocumentVisibilityState: NonNullable<StorefrontAnalyticsClientOptions["getDocumentVisibilityState"]>;
  private readonly debugEnabled: boolean;

  private sessionId: string | null = null;
  private attributionSnapshot: StorefrontAttributionSnapshot | null = null;
  private queue: Array<{ event: StorefrontAnalyticsQueuedEvent; attempt: number }> = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private started = false;

  private readonly handleVisibilityChange = () => {
    if (this.getDocumentVisibilityState() === "hidden") {
      void this.flush({ immediate: true, keepalive: true });
    }
  };

  private readonly handlePageHide = () => {
    void this.flush({ immediate: true, keepalive: true });
  };

  private readonly handleOnline = () => {
    this.scheduleFlush(50);
  };

  constructor(options: StorefrontAnalyticsClientOptions) {
    this.storeSlug = options.storeSlug.trim().toLowerCase();
    this.enabled = options.enabled ?? true;
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.maxBatchSize = options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.storage = options.storage === undefined ? createDefaultStorage() : options.storage;
    this.transport = options.transport ?? createDefaultTransport();
    this.scheduleTimeout = options.scheduleTimeout ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    this.clearScheduledTimeout = options.clearScheduledTimeout ?? ((handle) => clearTimeout(handle));
    this.generateId = options.generateId ?? defaultGenerateId;
    this.getEntryPath = options.getEntryPath ?? (() => (typeof window !== "undefined" ? normalizePath(window.location.pathname + window.location.search) : undefined));
    this.getUserAgent = options.getUserAgent ?? (() => (typeof navigator !== "undefined" ? navigator.userAgent : undefined));
    this.getReferrer = options.getReferrer ?? (() => (typeof document !== "undefined" ? normalizePath(document.referrer) : undefined));
    this.addWindowListener = options.addWindowListener ?? ((type, listener) => window.addEventListener(type, listener));
    this.removeWindowListener = options.removeWindowListener ?? ((type, listener) => window.removeEventListener(type, listener));
    this.addDocumentListener = options.addDocumentListener ?? ((type, listener) => document.addEventListener(type, listener));
    this.removeDocumentListener = options.removeDocumentListener ?? ((type, listener) => document.removeEventListener(type, listener));
    this.getDocumentVisibilityState = options.getDocumentVisibilityState ?? (() => (typeof document !== "undefined" ? document.visibilityState : undefined));
    this.debugEnabled =
      options.debug ??
      shouldEnableStorefrontAnalyticsDebug({
        search: options.getSearch ? options.getSearch() : typeof window !== "undefined" ? window.location.search : undefined,
        storage: getStorefrontAnalyticsDebugStorage(this.storage)
      });
  }

  start() {
    if (!canUseBrowserAnalytics(this.enabled, this.storage) || this.started) {
      return;
    }

    this.started = true;
    this.ensureSessionId();
    this.captureAttributionTouch(this.getEntryPath());
    this.addDocumentListener("visibilitychange", this.handleVisibilityChange);
    this.addWindowListener("pagehide", this.handlePageHide);
    this.addWindowListener("online", this.handleOnline);
  }

  stop() {
    if (!this.started) {
      return;
    }

    this.started = false;
    this.removeDocumentListener("visibilitychange", this.handleVisibilityChange);
    this.removeWindowListener("pagehide", this.handlePageHide);
    this.removeWindowListener("online", this.handleOnline);

    if (this.flushTimer) {
      this.clearScheduledTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  isEnabled() {
    return canUseBrowserAnalytics(this.enabled, this.storage);
  }

  getSessionId() {
    return this.ensureSessionId();
  }

  getAttributionSnapshot() {
    return this.resolveAttributionSnapshot();
  }

  getQueuedEventCount() {
    return this.queue.length;
  }

  isDebugEnabled() {
    return this.debugEnabled;
  }

  track(input: TrackStorefrontAnalyticsEventInput) {
    if (!this.isEnabled()) {
      return;
    }

    const sessionId = this.ensureSessionId();
    if (!sessionId) {
      return;
    }

    const event: StorefrontAnalyticsQueuedEvent = {
      ...input,
      path: normalizePath(input.path) ?? this.getEntryPath(),
      idempotencyKey: `${input.eventType}_${this.generateId()}`
    };

    this.captureAttributionTouch(event.path);
    this.queue.push({ event, attempt: 0 });
    this.emitDebug({
      phase: "track",
      eventType: event.eventType,
      queuedCount: this.queue.length,
      eventCount: 1
    });
    this.scheduleFlush();
  }

  async flush(options?: { immediate?: boolean; keepalive?: boolean }) {
    if (!this.isEnabled() || this.flushing || this.queue.length === 0) {
      return;
    }

    if (this.flushTimer) {
      this.clearScheduledTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    this.flushing = true;

    const batch = this.queue.splice(0, this.maxBatchSize);
    const sessionId = this.ensureSessionId();
    if (!sessionId) {
      this.flushing = false;
      return;
    }

    try {
      const result = await this.transport(
        {
          storeSlug: this.storeSlug,
          sessionId,
          entryPath: this.getEntryPath(),
          referrer: this.getReferrer(),
          userAgent: this.getUserAgent(),
          attribution: this.resolveAttributionSnapshot() ?? undefined,
          events: batch.map((entry) => entry.event)
        },
        { keepalive: options?.keepalive ?? false }
      );

      if (!result.ok) {
        this.emitDebug({
          phase: "flush_failure",
          eventCount: batch.length,
          queuedCount: this.queue.length + batch.length,
          reason: "transport_failed"
        });
        this.requeueFailedBatch(batch);
        return;
      }

      if (result.sessionId) {
        this.setSessionId(result.sessionId);
      }

      this.emitDebug({
        phase: "flush_success",
        eventCount: batch.length,
        queuedCount: this.queue.length
      });

      if (this.queue.length > 0 && !options?.immediate) {
        this.scheduleFlush(50);
      }
    } finally {
      this.flushing = false;
    }
  }

  private requeueFailedBatch(batch: Array<{ event: StorefrontAnalyticsQueuedEvent; attempt: number }>) {
    const retryable = batch
      .map((entry) => ({ ...entry, attempt: entry.attempt + 1 }))
      .filter((entry) => entry.attempt <= this.maxRetries);

    if (retryable.length === 0) {
      this.emitDebug({
        phase: "dropped",
        eventCount: batch.length,
        queuedCount: this.queue.length,
        reason: "max_retries_exceeded"
      });
      return;
    }

    this.queue = [...retryable, ...this.queue];
    const nextAttempt = Math.max(...retryable.map((entry) => entry.attempt));
    const backoffMs = Math.min(30_000, 1_000 * 2 ** Math.max(0, nextAttempt - 1));
    this.scheduleFlush(backoffMs);
  }

  private scheduleFlush(delayMs = this.flushIntervalMs) {
    if (!this.isEnabled() || this.queue.length === 0) {
      return;
    }

    if (this.flushTimer) {
      this.clearScheduledTimeout(this.flushTimer);
    }

    this.flushTimer = this.scheduleTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, delayMs);
  }

  private ensureSessionId() {
    if (this.sessionId) {
      return this.sessionId;
    }

    const storageKey = buildStorageKey(this.storeSlug);
    const storedSession = this.storage ? sanitizeSessionId(this.storage.getItem(storageKey)) : null;
    const resolved = storedSession ?? this.generateId();
    this.setSessionId(resolved);
    return this.sessionId;
  }

  private resolveAttributionSnapshot() {
    if (this.attributionSnapshot) {
      return this.attributionSnapshot;
    }

    this.attributionSnapshot = readStorefrontAttributionSnapshot(this.storeSlug, this.storage);
    if (!this.attributionSnapshot) {
      this.captureAttributionTouch(this.getEntryPath());
    }

    return this.attributionSnapshot;
  }

  private captureAttributionTouch(entryPath?: string) {
    if (!this.storage) {
      return;
    }

    const nextTouch = buildStorefrontAttributionTouch({
      entryPath,
      referrer: this.getReferrer(),
      storeSlug: this.storeSlug
    });
    const merged = mergeStorefrontAttributionSnapshot(this.attributionSnapshot, nextTouch);
    this.attributionSnapshot = merged;
    writeStorefrontAttributionSnapshot(this.storeSlug, merged, this.storage);
  }

  private setSessionId(value: string) {
    const normalized = sanitizeSessionId(value);
    if (!normalized) {
      return;
    }

    this.sessionId = normalized;
    if (this.storage) {
      this.storage.setItem(buildStorageKey(this.storeSlug), normalized);
    }
  }

  private emitDebug(event: Omit<Parameters<typeof emitStorefrontAnalyticsDebugEvent>[0], "storeSlug" | "sessionId">) {
    if (!this.debugEnabled) {
      return;
    }

    emitStorefrontAnalyticsDebugEvent({
      ...event,
      storeSlug: this.storeSlug,
      sessionId: this.sessionId
    });
  }
}

export function createStorefrontAnalyticsClient(options: StorefrontAnalyticsClientOptions) {
  return new StorefrontAnalyticsClient(options);
}

export type { StorefrontAnalyticsEventType, TrackStorefrontAnalyticsEventInput };
