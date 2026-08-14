import { describe, expect, it, vi } from "vitest";
import {
  getOrCreateCheckoutAttempt,
  readCheckoutAttempt,
  writeCheckoutAttempt
} from "@/lib/storefront/checkout-attempt-client";

describe("checkout attempt client", () => {
  it("keeps one id across retries and replaces it when purchase intent changes", () => {
    const createId = vi
      .fn()
      .mockReturnValueOnce("018f6fc1-8adc-7f43-8000-000000000201")
      .mockReturnValueOnce("018f6fc1-8adc-7f43-8000-000000000202");
    const intent = {
      email: "alice@example.com",
      fulfillmentMethod: "shipping",
      items: [{ variantId: "variant-1", quantity: 1 }]
    };

    const first = getOrCreateCheckoutAttempt(null, intent, createId);
    const retry = getOrCreateCheckoutAttempt(first, { ...intent }, createId);
    const changed = getOrCreateCheckoutAttempt(
      retry,
      { ...intent, items: [{ variantId: "variant-1", quantity: 2 }] },
      createId
    );

    expect(retry).toEqual(first);
    expect(changed.id).not.toBe(first.id);
    expect(createId).toHaveBeenCalledTimes(2);
  });

  it("canonicalizes object keys so equivalent intent does not rotate the id", () => {
    const createId = vi.fn(() => "018f6fc1-8adc-7f43-8000-000000000203");
    const first = getOrCreateCheckoutAttempt(null, { email: "a@example.com", quantity: 1 }, createId);
    const retry = getOrCreateCheckoutAttempt(first, { quantity: 1, email: "a@example.com" }, createId);

    expect(retry.id).toBe(first.id);
    expect(createId).toHaveBeenCalledTimes(1);
  });

  it("round-trips a valid attempt through session storage and ignores corrupt state", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    };
    const attempt = {
      id: "018f6fc1-8adc-7f43-8000-000000000204",
      canonicalIntent: "{\"quantity\":1}"
    };

    writeCheckoutAttempt(storage, "checkout", attempt);
    expect(readCheckoutAttempt(storage, "checkout")).toEqual(attempt);
    values.set("checkout", "{not-json");
    expect(readCheckoutAttempt(storage, "checkout")).toBeNull();
  });
});
