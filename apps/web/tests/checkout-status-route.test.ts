import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const checkRateLimitMock = vi.fn();
const resolveStoreSlugFromRequestAsyncMock = vi.fn();
const getStorefrontCheckoutBySessionIdMock = vi.fn();
const finalizeStorefrontCheckoutMock = vi.fn();
const retrieveCheckoutSessionMock = vi.fn();
const enqueueDigitalDeliveryMock = vi.fn();

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

vi.mock("@/lib/digital-products/delivery-jobs", () => ({
  enqueueDigitalDelivery: (...args: unknown[]) => enqueueDigitalDeliveryMock(...args)
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
  enqueueDigitalDeliveryMock.mockReset();

  checkRateLimitMock.mockResolvedValue(null);
  resolveStoreSlugFromRequestAsyncMock.mockResolvedValue("demo-store");
  getStorefrontCheckoutBySessionIdMock.mockResolvedValue({
    id: "checkout-1",
    status: "pending",
    order_id: null,
    error_message: null,
    stripe_payment_intent_id: "pi_123",
    digital_manifest_id: null
  });
  enqueueDigitalDeliveryMock.mockResolvedValue({ id: "delivery-job-1", status: "pending" });
  retrieveCheckoutSessionMock.mockResolvedValue({
    payment_status: "paid",
    payment_intent: "pi_123"
  });
});

describe("checkout status route", () => {
  test("returns the completed order after a paid-session finalization", async () => {
    finalizeStorefrontCheckoutMock.mockResolvedValue({
      status: "completed",
      orderId: "order-1"
    });

    const route = await import("@/app/api/orders/checkout-status/route");
    const request = new NextRequest("http://localhost:3000/api/orders/checkout-status?sessionId=cs_test_1234567890");

    const response = await route.GET(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "completed",
      orderId: "order-1"
    });
  });

  test("reports terminal digital delivery failure after paid-session finalization", async () => {
    getStorefrontCheckoutBySessionIdMock.mockResolvedValue({
      id: "checkout-1",
      status: "pending",
      order_id: null,
      error_message: null,
      stripe_payment_intent_id: "pi_123",
      digital_manifest_id: "manifest-1"
    });
    finalizeStorefrontCheckoutMock.mockResolvedValue({
      status: "completed",
      orderId: "order-1"
    });
    enqueueDigitalDeliveryMock.mockResolvedValue({
      id: "delivery-job-1",
      status: "failed"
    });

    const route = await import("@/app/api/orders/checkout-status/route");
    const request = new NextRequest(
      "http://localhost:3000/api/orders/checkout-status?sessionId=cs_test_paid_terminal_delivery"
    );

    const response = await route.GET(request);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      status: "delivery_failed",
      orderId: "order-1",
      digitalDeliveryStatus: "failed"
    });
  });

  test("returns the paid order by the webhook-bound session id without another Stripe lookup", async () => {
    getStorefrontCheckoutBySessionIdMock.mockResolvedValue({
      id: "checkout-1",
      status: "completed",
      order_id: "order-1",
      error_message: null,
      stripe_payment_intent_id: "pi_123",
      digital_manifest_id: null
    });
    const route = await import("@/app/api/orders/checkout-status/route");
    const request = new NextRequest("http://localhost:3000/api/orders/checkout-status?sessionId=cs_test_webhook_bound");

    const response = await route.GET(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "completed", orderId: "order-1" });
    expect(getStorefrontCheckoutBySessionIdMock).toHaveBeenCalledWith("demo-store", "cs_test_webhook_bound");
    expect(retrieveCheckoutSessionMock).not.toHaveBeenCalled();
    expect(finalizeStorefrontCheckoutMock).not.toHaveBeenCalled();
    expect(enqueueDigitalDeliveryMock).not.toHaveBeenCalled();
  });

  test("repairs a completed digital checkout before reporting completion", async () => {
    getStorefrontCheckoutBySessionIdMock.mockResolvedValue({
      id: "checkout-1",
      status: "completed",
      order_id: "order-1",
      error_message: null,
      stripe_payment_intent_id: "pi_123",
      digital_manifest_id: "manifest-1"
    });
    const route = await import("@/app/api/orders/checkout-status/route");
    const request = new NextRequest("http://localhost:3000/api/orders/checkout-status?sessionId=cs_test_digital_recovery");

    const response = await route.GET(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "completed",
      orderId: "order-1",
      digitalDeliveryStatus: "pending"
    });
    expect(enqueueDigitalDeliveryMock).toHaveBeenCalledWith("order-1", "manifest-1");
    expect(retrieveCheckoutSessionMock).not.toHaveBeenCalled();
    expect(finalizeStorefrontCheckoutMock).not.toHaveBeenCalled();
  });

  test.each(["processing", "succeeded"] as const)(
    "reports completed payment with %s digital delivery state",
    async (digitalDeliveryStatus) => {
      getStorefrontCheckoutBySessionIdMock.mockResolvedValue({
        id: "checkout-1",
        status: "completed",
        order_id: "order-1",
        error_message: null,
        stripe_payment_intent_id: "pi_123",
        digital_manifest_id: "manifest-1"
      });
      enqueueDigitalDeliveryMock.mockResolvedValue({
        id: "delivery-job-1",
        status: digitalDeliveryStatus
      });
      const route = await import("@/app/api/orders/checkout-status/route");
      const request = new NextRequest(
        `http://localhost:3000/api/orders/checkout-status?sessionId=cs_test_digital_${digitalDeliveryStatus}`
      );

      const response = await route.GET(request);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        status: "completed",
        orderId: "order-1",
        digitalDeliveryStatus
      });
    }
  );

  test("reports terminal digital delivery failure without exposing internal detail", async () => {
    getStorefrontCheckoutBySessionIdMock.mockResolvedValue({
      id: "checkout-1",
      status: "completed",
      order_id: "order-1",
      error_message: null,
      stripe_payment_intent_id: "pi_123",
      digital_manifest_id: "manifest-1"
    });
    enqueueDigitalDeliveryMock.mockResolvedValue({
      id: "delivery-job-1",
      status: "failed",
      lastSafeError: "Authorization: Bearer do-not-return-this"
    });
    const route = await import("@/app/api/orders/checkout-status/route");
    const request = new NextRequest(
      "http://localhost:3000/api/orders/checkout-status?sessionId=cs_test_digital_terminal_failure"
    );

    const response = await route.GET(request);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(response.headers.get("retry-after")).toBeNull();
    expect(payload).toEqual({
      status: "delivery_failed",
      orderId: "order-1",
      digitalDeliveryStatus: "failed",
      error:
        "Payment was received, but the digital downloads could not be prepared. Contact the store for help with this order."
    });
    expect(JSON.stringify(payload)).not.toContain("do-not-return-this");
  });

  test("keeps completed digital checkout recovery pollable when ensuring delivery fails", async () => {
    getStorefrontCheckoutBySessionIdMock.mockResolvedValue({
      id: "checkout-1",
      status: "completed",
      order_id: "order-1",
      error_message: null,
      stripe_payment_intent_id: "pi_123",
      digital_manifest_id: "manifest-1"
    });
    enqueueDigitalDeliveryMock.mockRejectedValue(new Error("database unavailable"));
    const route = await import("@/app/api/orders/checkout-status/route");
    const request = new NextRequest("http://localhost:3000/api/orders/checkout-status?sessionId=cs_test_digital_recovery_failure");

    const response = await route.GET(request);

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("2");
    await expect(response.json()).resolves.toEqual({
      status: "pending",
      error: "Digital delivery is still being prepared."
    });
    expect(retrieveCheckoutSessionMock).not.toHaveBeenCalled();
    expect(finalizeStorefrontCheckoutMock).not.toHaveBeenCalled();
  });
});
