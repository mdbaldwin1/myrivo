/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

function renderPage() {
  render(
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
});
