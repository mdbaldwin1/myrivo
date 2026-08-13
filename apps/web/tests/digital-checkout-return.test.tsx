/** @vitest-environment jsdom */

import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { StorefrontCheckoutPage } from "@/components/storefront/storefront-checkout-page";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams({ status: "success", session_id: "cs_test_digital_return" })
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a>
}));
vi.mock("@/components/storefront/storefront-header", () => ({ StorefrontHeader: () => <div>Header</div> }));
vi.mock("@/components/storefront/storefront-cart-button", () => ({ StorefrontCartButton: () => <div>Cart</div> }));
vi.mock("@/components/storefront/storefront-footer", () => ({ StorefrontFooter: () => <div>Footer</div> }));
vi.mock("@/components/storefront/storefront-runtime-provider", () => ({ useOptionalStorefrontRuntime: () => null }));
vi.mock("@/components/storefront/storefront-analytics-provider", () => ({ useOptionalStorefrontAnalytics: () => null }));
vi.mock("@/components/storefront/use-storefront-analytics-events", () => ({ useStorefrontPageView: () => undefined }));
vi.mock("@/lib/analytics/storefront-instrumentation", () => ({ markStorefrontCheckoutCompletedTracked: () => true }));
vi.mock("@/lib/storefront/checkout-return-polling", () => ({
  CHECKOUT_RETURN_POLLING: {
    timeoutMs: 250,
    initialDelayMs: 1,
    maximumDelayMs: 4,
    backoffMultiplier: 2
  }
}));

function renderPage() {
  return render(
    <StorefrontCheckoutPage
      store={{ id: "store-1", name: "Art Store", slug: "art-store" }}
      branding={null}
      settings={{
        announcement: null,
        support_email: "support@example.test",
        footer_tagline: null,
        footer_note: null,
        instagram_url: null,
        facebook_url: null,
        tiktok_url: null,
        storefront_copy_json: null,
        checkout_notice: null
      }}
    />
  );
}

describe("digital checkout return", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test("keeps polling while files are processing, then shows a safe download action and mixed-order next steps", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: "completed",
        orderId: "order-1",
        checkoutComposition: "mixed",
        digitalDeliveryStatus: "processing"
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: "completed",
        orderId: "order-1",
        checkoutComposition: "mixed",
        digitalDeliveryStatus: "succeeded",
        digitalAccessUrl: "/downloads/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12"
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    renderPage();

    expect(await screen.findByText("Preparing files")).toBeTruthy();
    const link = await screen.findByRole("link", { name: "View downloads" });
    expect(link.getAttribute("href")).toBe("/downloads/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12");
    expect(screen.getByText(/physical items will continue through shipping or pickup/i)).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  test("never renders an access action while delivery is only pending", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      status: "completed",
      orderId: "order-2",
      checkoutComposition: "digital_only",
      digitalDeliveryStatus: "pending"
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
    renderPage();

    expect(await screen.findByText("Preparing files")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "View downloads" })).toBeNull();
  });

  test("continues polling beyond the previous eight-attempt limit", async () => {
    let attempt = 0;
    const fetchMock = vi.fn(async () => {
      attempt += 1;
      return new Response(JSON.stringify(attempt <= 10 ? {
        status: "completed",
        orderId: "order-long-running",
        checkoutComposition: "digital_only",
        digitalDeliveryStatus: "processing"
      } : {
        status: "completed",
        orderId: "order-long-running",
        checkoutComposition: "digital_only",
        digitalDeliveryStatus: "succeeded",
        digitalAccessUrl: "/downloads/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12"
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    expect(await screen.findByRole("link", { name: "View downloads" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(11);
  });

  test("stops polling after unmount and aborts the active request", async () => {
    const signals: AbortSignal[] = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      signals.push(init?.signal as AbortSignal);
      return new Response(JSON.stringify({
        status: "completed",
        orderId: "order-unmounted",
        checkoutComposition: "digital_only",
        digitalDeliveryStatus: "processing"
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = renderPage();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    view.unmount();
    const callsAtUnmount = fetchMock.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 15));

    expect(fetchMock).toHaveBeenCalledTimes(callsAtUnmount);
    expect(signals[0]?.aborted).toBe(true);
  });

  test("offers a manual status retry after the long-poll timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      status: "completed",
      orderId: "order-timeout",
      checkoutComposition: "digital_only",
      digitalDeliveryStatus: "processing"
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    renderPage();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    const retry = screen.getByRole("button", { name: "Check again" });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      status: "completed",
      orderId: "order-timeout",
      checkoutComposition: "digital_only",
      digitalDeliveryStatus: "succeeded",
      digitalAccessUrl: "/downloads/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12"
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    retry.click();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByRole("link", { name: "View downloads" })).toBeTruthy();
  });
});
