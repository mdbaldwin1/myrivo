import { beforeEach, describe, expect, test, vi } from "vitest";
import { createStorefrontAnalyticsClient } from "@/lib/analytics/client";

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    }
  };
}

describe("storefront analytics client", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test("persists the analytics session id per store", () => {
    const storage = createMemoryStorage();
    const client = createStorefrontAnalyticsClient({
      storeSlug: "olive-mercantile",
      storage,
      generateId: () => "persisted_session_1234",
      transport: vi.fn(async () => ({ ok: true }))
    });

    expect(client.getSessionId()).toBe("persisted_session_1234");
    expect(storage.getItem("myrivo.analytics.session.olive-mercantile")).toBe("persisted_session_1234");
  });

  test("batches tracked events and flushes them through the transport", async () => {
    const transport = vi.fn(async () => ({ ok: true, sessionId: "server_session_1234" }));
    const client = createStorefrontAnalyticsClient({
      storeSlug: "olive-mercantile",
      storage: createMemoryStorage(),
      flushIntervalMs: 500,
      generateId: () => "session_or_event_1234",
      getEntryPath: () => "/landing?utm_source=instagram",
      getReferrer: () => "https://instagram.com/p/123",
      transport
    });

    client.track({ eventType: "page_view", path: "/landing?utm_source=instagram" });
    client.track({ eventType: "product_view", path: "/products/body-oil" });

    expect(client.getQueuedEventCount()).toBe(2);

    await vi.advanceTimersByTimeAsync(500);

    expect(transport).toHaveBeenCalledTimes(1);
    expect(client.getQueuedEventCount()).toBe(0);

    const firstTransportCall = transport.mock.calls as unknown as Array<
      [{
        storeSlug: string;
        attribution?: { firstTouch?: { entryPath?: string; utmSource?: string } };
        events: Array<{ idempotencyKey: string }>;
      }]
    >;
    const payload = firstTransportCall[0]?.[0];
    expect(payload?.storeSlug).toBe("olive-mercantile");
    expect(payload?.events).toHaveLength(2);
    expect(payload?.events[0]?.idempotencyKey).toContain("page_view");
    expect(payload?.attribution?.firstTouch?.entryPath).toBe("/landing?utm_source=instagram");
    expect(payload?.attribution?.firstTouch?.utmSource).toBe("instagram");
    expect(client.getSessionId()).toBe("server_session_1234");
  });

  test("retries failed deliveries with exponential backoff", async () => {
    const transport = vi
      .fn(async () => ({ ok: false }))
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });

    const client = createStorefrontAnalyticsClient({
      storeSlug: "olive-mercantile",
      storage: createMemoryStorage(),
      flushIntervalMs: 250,
      generateId: () => "session_or_event_1234",
      transport: transport as never
    });

    client.track({ eventType: "checkout_started", path: "/checkout" });

    await vi.advanceTimersByTimeAsync(250);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(client.getQueuedEventCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(client.getQueuedEventCount()).toBe(0);
  });

  test("stays inert when analytics is disabled", async () => {
    const transport = vi.fn(async () => ({ ok: true }));
    const client = createStorefrontAnalyticsClient({
      storeSlug: "olive-mercantile",
      enabled: false,
      storage: null,
      transport
    });

    client.start();
    client.track({ eventType: "page_view", path: "/" });
    await client.flush();

    expect(client.isEnabled()).toBe(false);
    expect(client.getQueuedEventCount()).toBe(0);
    expect(transport).not.toHaveBeenCalled();
  });
});
