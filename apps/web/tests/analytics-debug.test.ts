import { beforeEach, describe, expect, test, vi } from "vitest";
import { createStorefrontAnalyticsClient } from "@/lib/analytics/client";
import { shouldEnableStorefrontAnalyticsDebug } from "@/lib/analytics/debug";

function createMemoryStorage(initial?: Record<string, string>) {
  const values = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    }
  };
}

describe("storefront analytics debug helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test("enables debug mode from query params", () => {
    expect(shouldEnableStorefrontAnalyticsDebug({ search: "?analyticsDebug=1" })).toBe(true);
    expect(shouldEnableStorefrontAnalyticsDebug({ search: "?debugAnalytics=true" })).toBe(true);
    expect(shouldEnableStorefrontAnalyticsDebug({ search: "" })).toBe(false);
  });

  test("enables debug mode from local storage flag", () => {
    expect(
      shouldEnableStorefrontAnalyticsDebug({
        storage: createMemoryStorage({ "myrivo.analytics.debug": "true" })
      })
    ).toBe(true);
  });

  test("emits debug events for tracked and flushed analytics batches", async () => {
    const debugEvents: Array<{ detail: unknown }> = [];
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const windowMock = {
      location: { search: "?analyticsDebug=1" },
      localStorage: createMemoryStorage(),
      dispatchEvent: vi.fn((event: { detail: unknown }) => {
        debugEvents.push({ detail: event.detail });
        return true;
      }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
    const documentMock = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      visibilityState: "visible" as DocumentVisibilityState
    };

    vi.stubGlobal("window", windowMock);
    vi.stubGlobal("document", documentMock);
    vi.stubGlobal(
      "CustomEvent",
      class {
        type: string;
        detail: unknown;
        constructor(type: string, options?: { detail?: unknown }) {
          this.type = type;
          this.detail = options?.detail;
        }
      }
    );

    const transport = vi.fn(async () => ({ ok: true }));
    const client = createStorefrontAnalyticsClient({
      storeSlug: "olive-mercantile",
      storage: createMemoryStorage(),
      flushIntervalMs: 250,
      generateId: () => "session_or_event_1234",
      transport
    });

    client.track({ eventType: "page_view", path: "/s/olive-mercantile" });
    await vi.advanceTimersByTimeAsync(250);

    expect(client.isDebugEnabled()).toBe(true);
    expect(debugEvents).toHaveLength(2);
    expect(debugEvents[0]?.detail).toMatchObject({ phase: "track", eventType: "page_view" });
    expect(debugEvents[1]?.detail).toMatchObject({ phase: "flush_success", eventCount: 1 });
    expect(infoSpy).toHaveBeenCalled();

    infoSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
