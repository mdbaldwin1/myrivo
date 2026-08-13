/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { StorefrontCartPage } from "@/components/storefront/storefront-cart-page";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  )
}));
vi.mock("@/components/storefront/storefront-header", () => ({ StorefrontHeader: () => null }));
vi.mock("@/components/storefront/storefront-cart-button", () => ({ StorefrontCartButton: () => null }));
vi.mock("@/components/storefront/storefront-footer", () => ({ StorefrontFooter: () => null }));
vi.mock("@/components/storefront/storefront-privacy-collection-notice", () => ({ StorefrontPrivacyCollectionNotice: () => null }));
vi.mock("@/components/storefront/storefront-runtime-provider", () => ({ useOptionalStorefrontRuntime: () => null }));
vi.mock("@/components/storefront/storefront-analytics-provider", () => ({ useOptionalStorefrontAnalytics: () => null }));
vi.mock("@/components/storefront/use-storefront-analytics-events", () => ({ useStorefrontPageView: () => undefined }));

const variantBase = {
  option_values: {},
  inventory_qty: 10,
  is_made_to_order: false,
  is_default: true,
  status: "active" as const,
  sort_order: 0,
  created_at: "2026-08-13T00:00:00.000Z"
};

describe("digital cart composition", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).startsWith("/api/customer/cart")) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`Unexpected fetch ${String(input)}`);
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("separates mixed delivery groups and puts linked consent immediately before payment", async () => {
    window.localStorage.setItem("aha-cart:single-store", JSON.stringify([
      { productId: "digital-product", variantId: "digital-variant", quantity: 1 },
      { productId: "physical-product", variantId: "physical-variant", quantity: 2 }
    ]));

    render(
      <StorefrontCartPage
        store={{ id: "store-1", name: "Art Store", slug: "art-store" }}
        branding={null}
        settings={{
          announcement: null,
          support_email: "help@example.test",
          footer_tagline: null,
          footer_note: null,
          instagram_url: null,
          facebook_url: null,
          tiktok_url: null,
          storefront_copy_json: null,
          checkout_enable_local_pickup: false,
          checkout_enable_flat_rate_shipping: true,
          checkout_flat_rate_shipping_label: "Shipping",
          checkout_flat_rate_shipping_fee_cents: 700,
          checkout_allow_order_note: false
        }}
        products={[
          {
            id: "digital-product",
            title: "Printable pack",
            slug: "printable-pack",
            product_type: "digital",
            product_variants: [{ ...variantBase, id: "digital-variant", title: "PDF", price_cents: 1200, inventory_qty: 0 }]
          },
          {
            id: "physical-product",
            title: "Frame",
            slug: "frame",
            product_type: "physical",
            product_variants: [{ ...variantBase, id: "physical-variant", title: "Oak", price_cents: 3000 }]
          }
        ]}
      />
    );

    expect(await screen.findByRole("heading", { name: "Digital delivery" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Physical items" })).toBeTruthy();
    expect(screen.queryByLabelText("Quantity of Printable pack")).toBeNull();
    expect(screen.getByLabelText("Quantity of Frame")).toBeTruthy();
    expect(screen.getByPlaceholderText("Phone")).toBeTruthy();
    expect(screen.getByText("Physical shipping")).toBeTruthy();

    const license = screen.getByRole("link", { name: "personal-use license" });
    const refund = screen.getByRole("link", { name: "digital refund policy" });
    expect(license.getAttribute("href")).toBe("/legal/digital-personal-use-license");
    expect(refund.getAttribute("href")).toBe("/docs/catalog-and-orders#digital-products");
    const consent = screen.getByRole("checkbox");
    const checkout = screen.getByRole("button", { name: "Checkout" });
    expect(consent.compareDocumentPosition(checkout) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
