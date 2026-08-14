/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { StorefrontCartButton } from "@/components/storefront/storefront-cart-button";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  )
}));

vi.mock("@/components/storefront/storefront-runtime-provider", () => ({
  useOptionalStorefrontRuntime: () => ({
    mode: "live",
    routeBasePath: "",
    products: [{
      id: "digital-product",
      product_type: "digital",
      product_variants: [{ id: "digital-variant", status: "active" }]
    }]
  })
}));

describe("StorefrontCartButton", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => cleanup());

  test("normalizes digital quantities before preview and hides arbitrary quantity controls", async () => {
    const previewBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/storefront/cart-preview")) {
        previewBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return new Response(JSON.stringify({
          items: [{
            key: "digital-product:digital-variant",
            productId: "digital-product",
            variantId: "digital-variant",
            productType: "digital",
            productTitle: "Printable pack",
            variantLabel: "PDF bundle",
            quantity: 1,
            unitPriceCents: 2400,
            lineTotalCents: 2400
          }],
          subtotalCents: 2400
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.startsWith("/api/customer/cart")) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`Unexpected fetch ${url}`);
    }));
    window.localStorage.setItem(
      "aha-cart:single-store",
      JSON.stringify([{ productId: "digital-product", variantId: "digital-variant", quantity: 9 }])
    );

    const user = userEvent.setup();
    render(<StorefrontCartButton storeSlug="art-store" />);
    await user.hover(screen.getByRole("link", { name: "Open cart" }));

    await waitFor(() => expect(previewBodies).toHaveLength(1));
    expect(previewBodies[0]).toEqual({
      entries: [{ productId: "digital-product", variantId: "digital-variant", quantity: 1 }]
    });
    expect(JSON.parse(window.localStorage.getItem("aha-cart:single-store") ?? "[]")).toEqual([
      { productId: "digital-product", variantId: "digital-variant", quantity: 1 }
    ]);
    expect(await screen.findByText("Instant digital delivery · Quantity 1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Increase quantity" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Decrease quantity" })).toBeNull();
  });
});
