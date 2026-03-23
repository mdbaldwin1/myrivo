import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const checkRateLimitMock = vi.fn();
const resolveStoreSlugFromRequestAsyncMock = vi.fn();
const getStorefrontCheckoutBySessionIdMock = vi.fn();
const finalizeStorefrontCheckoutMock = vi.fn();
const retrieveCheckoutSessionMock = vi.fn();

vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args)
}));

vi.mock("@/lib/stores/active-store", () => ({
  resolveStoreSlugFromRequestAsync: (...args: unknown[]) => resolveStoreSlugFromRequestAsyncMock(...args)
}));

vi.mock("@/lib/storefront/checkout-finalization", () => ({
  getStorefrontCheckoutBySessionId: (...args: unknown[]) => getStorefrontCheckoutBySessionIdMock(...args),
  finalizeStorefrontCheckout: (...args: unknown[]) => finalizeStorefrontCheckoutMock(...args)
}));

vi.mock("@/lib/env", () => ({
  isStripeStubMode: () => false
}));

vi.mock("@/lib/stripe/server", () => ({
  getStripeClient: () => ({
    checkout: {
      sessions: {
        retrieve: (...args: unknown[]) => retrieveCheckoutSessionMock(...args)
      }
    }
  })
}));

beforeEach(() => {
  vi.resetModules();
  checkRateLimitMock.mockReset();
  resolveStoreSlugFromRequestAsyncMock.mockReset();
  getStorefrontCheckoutBySessionIdMock.mockReset();
  finalizeStorefrontCheckoutMock.mockReset();
  retrieveCheckoutSessionMock.mockReset();

  checkRateLimitMock.mockResolvedValue(null);
  resolveStoreSlugFromRequestAsyncMock.mockResolvedValue("demo-store");
  getStorefrontCheckoutBySessionIdMock.mockResolvedValue({
    id: "checkout-1",
    status: "pending",
    order_id: null,
    error_message: null,
    stripe_payment_intent_id: "pi_123"
  });
  retrieveCheckoutSessionMock.mockResolvedValue({
    payment_status: "paid",
    payment_intent: "pi_123"
  });
});

describe("checkout status route", () => {
  test("returns failed when finalization refuses a non-live store", async () => {
    finalizeStorefrontCheckoutMock.mockResolvedValue({
      status: "failed",
      orderId: null,
      errorMessage: "Store is no longer live. Checkout cannot be completed."
    });

    const route = await import("@/app/api/orders/checkout-status/route");
    const request = new NextRequest("http://localhost:3000/api/orders/checkout-status?sessionId=cs_test_1234567890");

    const response = await route.GET(request);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      status: "failed",
      error: "Store is no longer live. Checkout cannot be completed."
    });
  });
});
