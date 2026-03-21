import { beforeEach, describe, expect, test, vi } from "vitest";

const headersMock = vi.fn();
const constructEventMock = vi.fn();
const retrieveChargeMock = vi.fn();
const beginStripeWebhookEventProcessingMock = vi.fn();
const markStripeWebhookEventProcessedMock = vi.fn();
const markStripeWebhookEventFailedMock = vi.fn();
const finalizeStorefrontCheckoutMock = vi.fn();
const markStorefrontCheckoutFailedMock = vi.fn();
const syncStripeRefundRecordMock = vi.fn();
const syncStripeDisputeRecordMock = vi.fn();

vi.mock("next/headers", () => ({
  headers: (...args: unknown[]) => headersMock(...args)
}));

vi.mock("@/lib/env", () => ({
  isStripeStubMode: () => false,
  getStripeEnv: () => ({
    STRIPE_WEBHOOK_SECRET: "whsec_test"
  })
}));

vi.mock("@/lib/stripe/server", () => ({
  getStripeClient: () => ({
    webhooks: {
      constructEvent: (...args: unknown[]) => constructEventMock(...args)
    },
    charges: {
      retrieve: (...args: unknown[]) => retrieveChargeMock(...args)
    }
  })
}));

vi.mock("@/lib/stripe/webhook-events", () => ({
  beginStripeWebhookEventProcessing: (...args: unknown[]) => beginStripeWebhookEventProcessingMock(...args),
  markStripeWebhookEventProcessed: (...args: unknown[]) => markStripeWebhookEventProcessedMock(...args),
  markStripeWebhookEventFailed: (...args: unknown[]) => markStripeWebhookEventFailedMock(...args)
}));

vi.mock("@/lib/storefront/checkout-finalization", () => ({
  finalizeStorefrontCheckout: (...args: unknown[]) => finalizeStorefrontCheckoutMock(...args),
  markStorefrontCheckoutFailed: (...args: unknown[]) => markStorefrontCheckoutFailedMock(...args)
}));

vi.mock("@/lib/orders/refund-dispute-sync", () => ({
  syncStripeRefundRecord: (...args: unknown[]) => syncStripeRefundRecordMock(...args),
  syncStripeDisputeRecord: (...args: unknown[]) => syncStripeDisputeRecordMock(...args)
}));

describe("Stripe webhooks route", () => {
  beforeEach(() => {
    vi.resetModules();
    headersMock.mockReset();
    constructEventMock.mockReset();
    retrieveChargeMock.mockReset();
    beginStripeWebhookEventProcessingMock.mockReset();
    markStripeWebhookEventProcessedMock.mockReset();
    markStripeWebhookEventFailedMock.mockReset();
    finalizeStorefrontCheckoutMock.mockReset();
    markStorefrontCheckoutFailedMock.mockReset();
    syncStripeRefundRecordMock.mockReset();
    syncStripeDisputeRecordMock.mockReset();

    headersMock.mockResolvedValue({
      get: vi.fn(() => "sig_test")
    });
  });

  test("skips duplicate webhook events before re-running side effects", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_123",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: {
            checkout_kind: "storefront_order",
            storefront_checkout_id: "checkout-1"
          },
          payment_intent: "pi_123",
          payment_status: "paid"
        }
      }
    });
    beginStripeWebhookEventProcessingMock.mockResolvedValue({ shouldProcess: false, reason: "processed" });

    const route = await import("@/app/api/stripe/webhooks/route");
    const response = await route.POST(
      new Request("http://localhost:3000/api/stripe/webhooks", {
        method: "POST",
        body: JSON.stringify({ id: "evt_123" })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      received: true,
      duplicate: true,
      type: "checkout.session.completed"
    });
    expect(finalizeStorefrontCheckoutMock).not.toHaveBeenCalled();
    expect(markStripeWebhookEventProcessedMock).not.toHaveBeenCalled();
  });

  test("marks the webhook event failed when checkout finalization throws", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_456",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: {
            checkout_kind: "storefront_order",
            storefront_checkout_id: "checkout-2"
          },
          payment_intent: "pi_456",
          payment_status: "paid"
        }
      }
    });
    beginStripeWebhookEventProcessingMock.mockResolvedValue({ shouldProcess: true });
    finalizeStorefrontCheckoutMock.mockRejectedValue(new Error("Checkout finalization failed."));

    const route = await import("@/app/api/stripe/webhooks/route");
    const response = await route.POST(
      new Request("http://localhost:3000/api/stripe/webhooks", {
        method: "POST",
        body: JSON.stringify({ id: "evt_456" })
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Checkout finalization failed."
    });
    expect(markStripeWebhookEventFailedMock).toHaveBeenCalledWith("evt_456", "Checkout finalization failed.");
  });
});
