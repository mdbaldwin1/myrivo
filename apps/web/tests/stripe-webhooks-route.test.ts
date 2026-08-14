import { beforeEach, describe, expect, test, vi } from "vitest";

const headersMock = vi.fn();
const constructEventMock = vi.fn();
const retrieveChargeMock = vi.fn();
const beginStripeWebhookEventProcessingMock = vi.fn();
const markStripeWebhookEventProcessedMock = vi.fn();
const markStripeWebhookEventFailedMock = vi.fn();
const finalizeStorefrontCheckoutMock = vi.fn();
const bindStorefrontCheckoutStripeSessionMock = vi.fn();
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
  bindStorefrontCheckoutStripeSession: (...args: unknown[]) => bindStorefrontCheckoutStripeSessionMock(...args),
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
    bindStorefrontCheckoutStripeSessionMock.mockReset();
    markStorefrontCheckoutFailedMock.mockReset();
    syncStripeRefundRecordMock.mockReset();
    syncStripeDisputeRecordMock.mockReset();
    bindStorefrontCheckoutStripeSessionMock.mockResolvedValue(undefined);

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
          id: "cs_test_finalize_failure",
          metadata: {
            checkout_kind: "storefront_order",
            storefront_checkout_id: "checkout-2",
            store_id: "store-2"
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

  test("binds an accepted Stripe session before finalizing so success polling can find it", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_789",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_accepted_before_db_write",
          url: null,
          metadata: {
            checkout_kind: "storefront_order",
            storefront_checkout_id: "40000000-0000-4000-8000-000000000001",
            store_id: "10000000-0000-4000-8000-000000000001"
          },
          payment_intent: "pi_789",
          payment_status: "paid"
        }
      }
    });
    beginStripeWebhookEventProcessingMock.mockResolvedValue({ shouldProcess: true });
    finalizeStorefrontCheckoutMock.mockResolvedValue({ status: "completed", orderId: "order-789" });

    const route = await import("@/app/api/stripe/webhooks/route");
    const response = await route.POST(
      new Request("http://localhost:3000/api/stripe/webhooks", {
        method: "POST",
        body: JSON.stringify({ id: "evt_789" })
      })
    );

    expect(response.status).toBe(200);
    expect(bindStorefrontCheckoutStripeSessionMock).toHaveBeenCalledWith({
      checkoutSessionId: "40000000-0000-4000-8000-000000000001",
      storeId: "10000000-0000-4000-8000-000000000001",
      stripeCheckoutSessionId: "cs_test_accepted_before_db_write",
      stripeCheckoutUrl: null
    });
    expect(bindStorefrontCheckoutStripeSessionMock.mock.invocationCallOrder[0]).toBeLessThan(
      finalizeStorefrontCheckoutMock.mock.invocationCallOrder[0]!
    );
    expect(markStripeWebhookEventProcessedMock).toHaveBeenCalledWith("evt_789");
  });

  test("passes immutable source ordering to refund sync and leaves an RPC failure retryable", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_refund_failure",
      type: "refund.updated",
      created: 1_786_640_400,
      data: {
        object: {
          id: "re_failure",
          object: "refund",
          created: 1_786_639_000,
          status: "succeeded",
        },
      },
    });
    beginStripeWebhookEventProcessingMock.mockResolvedValue({ shouldProcess: true });
    syncStripeRefundRecordMock.mockRejectedValue(
      new Error("Injected digital access RPC failure"),
    );

    const route = await import("@/app/api/stripe/webhooks/route");
    const response = await route.POST(
      new Request("http://localhost:3000/api/stripe/webhooks", {
        method: "POST",
        body: JSON.stringify({ id: "evt_refund_failure" }),
      }),
    );

    expect(syncStripeRefundRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "re_failure" }),
      {
        sourceEventId: "evt_refund_failure",
        sourceEventCreatedAt: "2026-08-13T17:00:00.000Z",
      },
    );
    expect(response.status).toBe(500);
    expect(markStripeWebhookEventProcessedMock).not.toHaveBeenCalled();
    expect(markStripeWebhookEventFailedMock).toHaveBeenCalledWith(
      "evt_refund_failure",
      "Injected digital access RPC failure",
    );
  });
});
