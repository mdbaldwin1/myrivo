import { describe, expect, it } from "vitest";
import { resolveCheckoutAttemptIdentity } from "@/lib/storefront/checkout-attempt-identity";

const baseIntent = {
  firstName: "Alice",
  lastName: "Buyer",
  email: "Alice@Example.com ",
  fulfillmentMethod: "shipping",
  promoCodes: ["WELCOME"],
  items: [
    {
      productId: "11111111-1111-4111-8111-111111111111",
      variantId: "33333333-3333-4333-8333-333333333333",
      quantity: 1
    }
  ]
};

describe("checkout attempt identity", () => {
  it("uses the caller attempt id while deriving a stable canonical fingerprint", () => {
    const first = resolveCheckoutAttemptIdentity({
      checkoutAttemptId: "018f6fc1-8adc-7f43-8000-000000000001",
      storeId: "10000000-0000-4000-8000-000000000001",
      customerEmail: "Alice@Example.com ",
      sourceCartId: null,
      intent: baseIntent
    });
    const second = resolveCheckoutAttemptIdentity({
      checkoutAttemptId: "018f6fc1-8adc-7f43-8000-000000000001",
      storeId: "10000000-0000-4000-8000-000000000001",
      customerEmail: "alice@example.com",
      sourceCartId: null,
      intent: {
        items: baseIntent.items,
        promoCodes: ["WELCOME"],
        fulfillmentMethod: "shipping",
        email: "Alice@Example.com ",
        lastName: "Buyer",
        firstName: "Alice"
      }
    });

    expect(first.attemptKey).toBe("018f6fc1-8adc-7f43-8000-000000000001");
    expect(first.fingerprintSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toEqual(first);
  });

  it("derives a bounded compatibility key when an older client omits one", () => {
    const first = resolveCheckoutAttemptIdentity({
      checkoutAttemptId: undefined,
      storeId: "10000000-0000-4000-8000-000000000001",
      customerEmail: "alice@example.com",
      sourceCartId: "20000000-0000-4000-8000-000000000001",
      intent: baseIntent
    });
    const second = resolveCheckoutAttemptIdentity({
      checkoutAttemptId: undefined,
      storeId: "10000000-0000-4000-8000-000000000001",
      customerEmail: "alice@example.com",
      sourceCartId: "20000000-0000-4000-8000-000000000001",
      intent: baseIntent
    });

    expect(first).toEqual(second);
    expect(first.attemptKey).toMatch(/^legacy:[a-f0-9]{64}$/);
    expect(first.attemptKey.length).toBeLessThanOrEqual(128);
  });

  it("changes the fingerprint when the canonical purchase intent changes", () => {
    const original = resolveCheckoutAttemptIdentity({
      checkoutAttemptId: "018f6fc1-8adc-7f43-8000-000000000001",
      storeId: "10000000-0000-4000-8000-000000000001",
      customerEmail: "alice@example.com",
      sourceCartId: null,
      intent: baseIntent
    });
    const changed = resolveCheckoutAttemptIdentity({
      checkoutAttemptId: "018f6fc1-8adc-7f43-8000-000000000001",
      storeId: "10000000-0000-4000-8000-000000000001",
      customerEmail: "alice@example.com",
      sourceCartId: null,
      intent: {
        ...baseIntent,
        items: [{ ...baseIntent.items[0]!, quantity: 2 }]
      }
    });

    expect(changed.attemptKey).toBe(original.attemptKey);
    expect(changed.fingerprintSha256).not.toBe(original.fingerprintSha256);
  });

  it("treats reordered and split cart lines as the same canonical purchase intent", () => {
    const itemA = {
      productId: "11111111-1111-4111-8111-111111111111",
      variantId: "33333333-3333-4333-8333-333333333333"
    };
    const itemB = {
      productId: "22222222-2222-4222-8222-222222222222",
      variantId: "44444444-4444-4444-8444-444444444444"
    };
    const resolve = (items: Array<Record<string, unknown>>) =>
      resolveCheckoutAttemptIdentity({
        checkoutAttemptId: "018f6fc1-8adc-7f43-8000-000000000001",
        storeId: "10000000-0000-4000-8000-000000000001",
        customerEmail: "alice@example.com",
        sourceCartId: null,
        intent: { ...baseIntent, items }
      });

    expect(resolve([{ ...itemA, quantity: 2 }, { ...itemB, quantity: 1 }])).toEqual(
      resolve([{ ...itemB, quantity: 1 }, { ...itemA, quantity: 1 }, { ...itemA, quantity: 1 }])
    );
  });
});
