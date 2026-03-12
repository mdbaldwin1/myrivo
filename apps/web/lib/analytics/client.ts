import type { CollectAnalyticsEvent } from "@/lib/analytics/collect";
import { sanitizeSessionId, storefrontEventTypes } from "@/lib/analytics/collect";

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
};

type TrackStorefrontAnalyticsEventInput = Omit<CollectAnalyticsEvent, "idempotencyKey"> & {
  eventType: StorefrontAnalyticsEventType;
};

const DEFAULT_FLUSH_INTERVAL_MS = 1_000;
const DEFAULT_MAX_BATCH_SIZE = 20;
const DEFAULT_MAX_RETRIES = 3;
const SESSION_STORAGE_KEY_PREFIX = "myrivo.analytics.session.";

function defaultGenerateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replaceAll("-", "");
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function buildStorageKey(storeSlug: string) {
  return `${SESSION_STORAGE_KEY_PREFIX}${storeSlug}`;
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

  private sessionId: string | null = null;
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
  }

  start() {
    if (!canUseBrowserAnalytics(this.enabled, this.storage) || this.started) {
      return;
    }

    this.started = true;
    this.ensureSessionId();
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

  getQueuedEventCount() {
    return this.queue.length;
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

    this.queue.push({ event, attempt: 0 });
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
          events: batch.map((entry) => entry.event)
        },
        { keepalive: options?.keepalive ?? false }
      );

      if (!result.ok) {
        this.requeueFailedBatch(batch);
        return;
      }

      if (result.sessionId) {
        this.setSessionId(result.sessionId);
      }

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
}

export function createStorefrontAnalyticsClient(options: StorefrontAnalyticsClientOptions) {
  return new StorefrontAnalyticsClient(options);
}

export type { StorefrontAnalyticsEventType, TrackStorefrontAnalyticsEventInput };
