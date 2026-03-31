/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { StorefrontCartPage } from "@/components/storefront/storefront-cart-page";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("@/components/storefront/storefront-header", () => ({
  StorefrontHeader: () => <div>Header</div>
}));

vi.mock("@/components/storefront/storefront-cart-button", () => ({
  StorefrontCartButton: () => <div>Cart button</div>
}));

vi.mock("@/components/storefront/storefront-footer", () => ({
  StorefrontFooter: () => <div>Footer</div>
}));

vi.mock("@/components/storefront/storefront-privacy-collection-notice", () => ({
  StorefrontPrivacyCollectionNotice: () => <div>Privacy notice</div>
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

describe("StorefrontCartPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("keeps pickup selected when pickup options are unavailable and exposes email autofill", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.startsWith("/api/customer/cart")) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.startsWith("/api/storefront/pickup-options")) {
        return new Response(
          JSON.stringify({
            pickupEnabled: false,
            selectionMode: "buyer_select",
            options: [],
            selectedLocationId: null,
            slots: [],
            reason: "Enable location sharing to verify pickup availability."
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      throw new Error(`Unexpected fetch ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.setItem(
      "aha-cart:single-store",
      JSON.stringify([{ productId: "product-1", variantId: "variant-1", quantity: 1 }])
    );

    render(
      <StorefrontCartPage
        store={{ id: "store-1", name: "At Home Apothecary", slug: "at-home-apothecary" }}
        branding={null}
        settings={{
          announcement: null,
          support_email: "support@example.com",
          footer_tagline: null,
          footer_note: null,
          instagram_url: null,
          facebook_url: null,
          tiktok_url: null,
          storefront_copy_json: null,
          checkout_enable_local_pickup: true,
          checkout_local_pickup_label: "Local pickup",
          checkout_local_pickup_fee_cents: 0,
          checkout_enable_flat_rate_shipping: true,
          checkout_flat_rate_shipping_label: "Shipping",
          checkout_flat_rate_shipping_fee_cents: 500,
          checkout_allow_order_note: false,
          checkout_order_note_prompt: null
        }}
        products={[
          {
            id: "product-1",
            title: "Whipped Tallow Balm",
            slug: "whipped-tallow-balm",
            image_urls: [],
            image_alt_text: null,
            product_variants: [
              {
                id: "variant-1",
                title: "Default",
                option_values: {},
                price_cents: 1800,
                inventory_qty: 12,
                is_made_to_order: false,
                is_default: true,
                status: "active",
                sort_order: 0,
                created_at: "2026-03-31T00:00:00.000Z"
              }
            ]
          }
        ]}
      />
    );

    const emailInput = await screen.findByPlaceholderText("you@example.com");
    expect(emailInput.getAttribute("autocomplete")).toBe("email");

    await user.click(screen.getByRole("radio", { name: /local pickup/i }));

    await waitFor(() => {
      expect((screen.getByRole("radio", { name: /local pickup/i }) as HTMLInputElement).checked).toBe(true);
    });

    expect(screen.getByText("Enable location sharing to verify pickup availability.")).toBeTruthy();
    expect((screen.getByRole("radio", { name: /shipping/i }) as HTMLInputElement).checked).toBe(false);
  });
});
