/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { StorefrontCheckoutPage } from "@/components/storefront/storefront-checkout-page";

vi.mock("next/navigation", () => ({
  useSearchParams: () =>
    new URLSearchParams({
      status: "success",
      session_id: "cs_test_terminal_delivery_failure"
    })
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("@/components/storefront/storefront-header", () => ({
  StorefrontHeader: () => <div>Store header</div>
}));

vi.mock("@/components/storefront/storefront-cart-button", () => ({
  StorefrontCartButton: () => <div>Cart button</div>
}));

vi.mock("@/components/storefront/storefront-footer", () => ({
  StorefrontFooter: () => <div>Store footer</div>
}));

vi.mock("@/components/storefront/storefront-runtime-provider", () => ({
  useOptionalStorefrontRuntime: () => null
}));

vi.mock("@/components/storefront/storefront-analytics-provider", () => ({
  useOptionalStorefrontAnalytics: () => null
}));

vi.mock("@/components/storefront/use-storefront-analytics-events", () => ({
  useStorefrontPageView: () => undefined
}));

vi.mock("@/lib/analytics/storefront-instrumentation", () => ({
  markStorefrontCheckoutCompletedTracked: () => true
}));

const terminalError =
  "Payment was received, but the digital downloads could not be prepared. Contact the store for help with this order.";

function renderCheckout(supportEmail: string | null, orderId: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: "delivery_failed",
          orderId,
          checkoutComposition: "mixed",
          digitalDeliveryStatus: "failed",
          error: terminalError
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" }
        }
      )
    )
  );

  render(
    <StorefrontCheckoutPage
      store={{ id: "store-1", name: "Digital Art Shop", slug: "digital-art-shop" }}
      branding={null}
      settings={{
        announcement: null,
        support_email: supportEmail,
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

describe("storefront checkout terminal digital delivery failure", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("keeps the paid order visible and offers encoded store email support", async () => {
    renderCheckout("support@example.test", "order/42?source=email");

    await waitFor(() => {
      expect(screen.getByText("Order order/42?source=email placed successfully.")).toBeTruthy();
    });

    expect(screen.getByRole("status").textContent).toContain(terminalError);
    expect(screen.getByRole("status").textContent).toContain("Digital delivery needs help");
    expect(screen.getByText(/physical items will continue through shipping or pickup/i)).toBeTruthy();
    expect(screen.queryByText("Payment received. Finalizing your order...")).toBeNull();
    expect(screen.getByRole("link", { name: "Contact store support" }).getAttribute("href")).toBe(
      "mailto:support@example.test?subject=Digital%20download%20help%20for%20order%20order%2F42%3Fsource%3Demail"
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("offers storefront support information when no store email is configured", async () => {
    renderCheckout(null, "order-43");

    await waitFor(() => {
      expect(screen.getByText("Order order-43 placed successfully.")).toBeTruthy();
    });

    expect(screen.getByRole("link", { name: "View store support information" }).getAttribute("href")).toBe(
      "/policies"
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
