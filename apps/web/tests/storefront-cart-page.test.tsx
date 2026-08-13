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

  test("reuses the checkout attempt id when a recoverable request is retried", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "018f6fc1-8adc-7f43-8000-000000000301"
    );
    const checkoutBodies: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/customer/cart")) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url.startsWith("/api/orders/checkout")) {
        checkoutBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return new Response(
          JSON.stringify({
            error: "We could not confirm checkout yet. Please try again; you will not be charged twice."
          }),
          { status: 503, headers: { "Content-Type": "application/json" } }
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
          checkout_enable_local_pickup: false,
          checkout_enable_flat_rate_shipping: true,
          checkout_flat_rate_shipping_label: "Shipping",
          checkout_flat_rate_shipping_fee_cents: 500,
          checkout_allow_order_note: false
        }}
        products={[
          {
            id: "product-1",
            title: "Whipped Tallow Balm",
            slug: "whipped-tallow-balm",
            product_type: "physical",
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

    await user.type(await screen.findByPlaceholderText("First name"), "Alice");
    await user.type(screen.getByPlaceholderText("Last name"), "Buyer");
    await user.type(screen.getByPlaceholderText("Phone"), "555-0100");
    await user.type(screen.getByPlaceholderText("you@example.com"), "alice@example.com");
    await user.click(screen.getByRole("button", { name: "Checkout" }));
    await screen.findByText(/you will not be charged twice/i);
    await user.click(screen.getByRole("button", { name: "Checkout" }));

    await waitFor(() => expect(checkoutBodies).toHaveLength(2));
    expect(checkoutBodies.map((body) => body.checkoutAttemptId)).toEqual([
      "018f6fc1-8adc-7f43-8000-000000000301",
      "018f6fc1-8adc-7f43-8000-000000000301"
    ]);
  });

  test("collapses duplicate digital lines and presents instant delivery without physical controls", async () => {
    const promoBodies: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/customer/cart")) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url.startsWith("/api/promotions/preview")) {
        promoBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return new Response(JSON.stringify({
          promoCodes: ["WELCOME"],
          discountCents: 0,
          shippingDiscountCents: 0,
          effectiveShippingFeeCents: 0
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.setItem(
      "aha-cart:single-store",
      JSON.stringify([
        { productId: "digital-product", variantId: "digital-variant", quantity: 7 },
        { productId: "digital-product", variantId: "digital-variant", quantity: 1 }
      ])
    );

    render(
      <StorefrontCartPage
        store={{ id: "store-1", name: "Art Store", slug: "art-store" }}
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
          checkout_local_pickup_label: "Studio pickup",
          checkout_local_pickup_fee_cents: 0,
          checkout_enable_flat_rate_shipping: false,
          checkout_flat_rate_shipping_label: "Shipping",
          checkout_flat_rate_shipping_fee_cents: 900,
          checkout_allow_order_note: false,
          checkout_max_promo_codes: 1
        }}
        products={[{
          id: "digital-product",
          title: "Printable pack",
          slug: "printable-pack",
          product_type: "digital",
          product_variants: [{
            id: "digital-variant",
            title: "PDF bundle",
            option_values: {},
            price_cents: 2400,
            inventory_qty: 0,
            is_made_to_order: false,
            is_default: true,
            status: "active",
            sort_order: 0,
            created_at: "2026-08-13T00:00:00.000Z"
          }]
        }]}
      />
    );

    expect(await screen.findByText("Instant digital delivery · Quantity 1")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1);
    expect(screen.queryByLabelText("Quantity of Printable pack")).toBeNull();
    expect(screen.queryByPlaceholderText("Phone")).toBeNull();
    expect(screen.queryByRole("radio", { name: /studio pickup/i })).toBeNull();
    expect(screen.getByText("Digital delivery")).toBeTruthy();

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("aha-cart:single-store") ?? "[]")).toEqual([
        { productId: "digital-product", variantId: "digital-variant", quantity: 1 }
      ]);
    });

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Promo code (optional)"), "welcome");
    await user.click(screen.getByRole("button", { name: "Apply promo" }));
    await waitFor(() => expect(promoBodies).toHaveLength(1));
    expect(promoBodies[0]).toMatchObject({ shippingFeeCents: 0 });
  });

  test("removes a stale variant instead of substituting the current default variant", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/customer/cart")) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`Unexpected fetch ${url}`);
    }));
    window.localStorage.setItem(
      "aha-cart:single-store",
      JSON.stringify([{ productId: "product-1", variantId: "retired-variant", quantity: 2 }])
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
          checkout_enable_local_pickup: false,
          checkout_enable_flat_rate_shipping: true,
          checkout_flat_rate_shipping_label: "Shipping",
          checkout_flat_rate_shipping_fee_cents: 500,
          checkout_allow_order_note: false
        }}
        products={[{
          id: "product-1",
          title: "Whipped Tallow Balm",
          slug: "whipped-tallow-balm",
          product_type: "physical",
          product_variants: [{
            id: "current-default",
            title: "Current default",
            option_values: {},
            price_cents: 1800,
            inventory_qty: 12,
            is_made_to_order: false,
            is_default: true,
            status: "active",
            sort_order: 0,
            created_at: "2026-08-13T00:00:00.000Z"
          }]
        }]}
      />
    );

    expect(await screen.findByText("Your cart is empty.")).toBeTruthy();
    expect(screen.queryByText("Whipped Tallow Balm")).toBeNull();
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("aha-cart:single-store") ?? "[]")).toEqual([]);
    });
  });

  test("submits normalized digital intent without phone or physical fulfillment", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "018f6fc1-8adc-7f43-8000-000000000602"
    );
    let checkoutBody: Record<string, unknown> | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/customer/cart")) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url.startsWith("/api/orders/checkout")) {
        checkoutBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(JSON.stringify({
          error: "We could not confirm checkout yet. Please try again; you will not be charged twice."
        }), { status: 503, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.setItem(
      "aha-cart:single-store",
      JSON.stringify([{ productId: "digital-product", variantId: "digital-variant", quantity: 4 }])
    );

    render(
      <StorefrontCartPage
        store={{ id: "store-1", name: "Art Store", slug: "art-store" }}
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
          checkout_enable_flat_rate_shipping: false,
          checkout_allow_order_note: false
        }}
        products={[{
          id: "digital-product",
          title: "Printable pack",
          slug: "printable-pack",
          product_type: "digital",
          product_variants: [{
            id: "digital-variant",
            title: "PDF bundle",
            option_values: {},
            price_cents: 2400,
            inventory_qty: 0,
            is_made_to_order: false,
            is_default: true,
            status: "active",
            sort_order: 0,
            created_at: "2026-08-13T00:00:00.000Z"
          }]
        }]}
      />
    );

    await user.type(await screen.findByPlaceholderText("First name"), "Alice");
    await user.type(screen.getByPlaceholderText("Last name"), "Buyer");
    await user.type(screen.getByPlaceholderText("you@example.com"), "alice@example.com");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Checkout" }));

    await waitFor(() => expect(checkoutBody).not.toBeNull());
    expect(checkoutBody).not.toHaveProperty("phone");
    expect(checkoutBody).not.toHaveProperty("fulfillmentMethod");
    expect(checkoutBody).toMatchObject({
      digitalDeliveryConsent: true,
      items: [{ productId: "digital-product", variantId: "digital-variant", quantity: 1 }]
    });
  });
});
