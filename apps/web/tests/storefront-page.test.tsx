/* eslint-disable @next/next/no-img-element */
/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { StorefrontPage } from "@/components/storefront/storefront-page";

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt} {...props} />
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
    <select {...props}>{children}</select>
  )
}));

vi.mock("@/components/storefront/storefront-header", () => ({
  StorefrontHeader: () => <div>Header</div>
}));

vi.mock("@/components/storefront/storefront-image-carousel", () => ({
  StorefrontImageCarousel: ({ images }: { images: string[] }) => <div>{images[0] ?? "carousel"}</div>
}));

vi.mock("@/components/storefront/storefront-cart-button", () => ({
  StorefrontCartButton: () => <div>Cart button</div>
}));

vi.mock("@/components/storefront/storefront-footer", () => ({
  StorefrontFooter: () => <div>Footer</div>
}));

vi.mock("@/components/storefront/storefront-reviews-section", () => ({
  StorefrontReviewsSection: () => <div>Reviews</div>
}));

vi.mock("@/components/storefront/storefront-runtime-provider", () => ({
  useOptionalStorefrontRuntime: () => null
}));

vi.mock("@/components/storefront/storefront-analytics-provider", () => ({
  useOptionalStorefrontAnalytics: () => null
}));

vi.mock("@/components/storefront/use-storefront-analytics-events", () => ({
  useStorefrontPageView: () => undefined,
  useStorefrontSearchAnalytics: () => undefined
}));

vi.mock("@/components/dashboard/storefront-studio-document-provider", () => ({
  useOptionalStorefrontStudioDocument: () => null
}));

describe("StorefrontPage quick add", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("shows transient add-to-cart feedback on quick add", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    render(
      <StorefrontPage
        store={{ id: "store-1", name: "At Home Apothecary", slug: "at-home-apothecary" }}
        branding={null}
        settings={{
          support_email: "support@example.com",
          fulfillment_message: null,
          shipping_policy: null,
          return_policy: null,
          announcement: null,
          footer_tagline: null,
          footer_note: null,
          instagram_url: null,
          facebook_url: null,
          tiktok_url: null,
          email_capture_enabled: false,
          email_capture_heading: null,
          email_capture_description: null,
          email_capture_success_message: null,
          storefront_copy_json: null
        }}
        contentBlocks={[]}
        products={[
          {
            id: "product-1",
            title: "Whipped Tallow Balm",
            description: "A soothing balm.",
            slug: "whipped-tallow-balm",
            image_urls: [],
            image_alt_text: null,
            seo_title: null,
            seo_description: null,
            is_featured: true,
            created_at: "2026-03-31T00:00:00.000Z",
            price_cents: 1800,
            inventory_qty: 12,
            product_variants: [
              {
                id: "variant-1",
                title: "Default",
                image_urls: [],
                group_image_urls: [],
                option_values: {},
                price_cents: 1800,
                inventory_qty: 12,
                is_made_to_order: false,
                is_default: true,
                status: "active",
                sort_order: 0,
                created_at: "2026-03-31T00:00:00.000Z"
              }
            ],
            product_option_axes: []
          }
        ]}
        view="products"
      />
    );

    const button = screen.getByRole("button", { name: "Add" });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Added to cart" }).getAttribute("disabled")).not.toBeNull();
    });

  }, 10000);

  test("quick add normalizes an existing digital line to quantity one before persistence and sync", async () => {
    const user = userEvent.setup();
    const syncedBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      syncedBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }));
    window.localStorage.setItem(
      "aha-cart:single-store",
      JSON.stringify([{ productId: "digital-product", variantId: "digital-variant", quantity: 8 }])
    );

    render(
      <StorefrontPage
        store={{ id: "store-1", name: "Art Store", slug: "art-store" }}
        branding={null}
        settings={{
          support_email: "support@example.com",
          fulfillment_message: null,
          shipping_policy: null,
          return_policy: null,
          announcement: null,
          footer_tagline: null,
          footer_note: null,
          instagram_url: null,
          facebook_url: null,
          tiktok_url: null,
          email_capture_enabled: false,
          email_capture_heading: null,
          email_capture_description: null,
          email_capture_success_message: null,
          storefront_copy_json: null
        }}
        contentBlocks={[]}
        products={[{
          id: "digital-product",
          title: "Printable pack",
          description: "A printable pack.",
          slug: "printable-pack",
          image_urls: [],
          image_alt_text: null,
          seo_title: null,
          seo_description: null,
          is_featured: true,
          created_at: "2026-08-13T00:00:00.000Z",
          price_cents: 2400,
          inventory_qty: 0,
          product_type: "digital",
          product_variants: [{
            id: "digital-variant",
            title: "PDF bundle",
            image_urls: [],
            group_image_urls: [],
            option_values: {},
            price_cents: 2400,
            inventory_qty: 0,
            is_made_to_order: false,
            is_default: true,
            status: "active",
            sort_order: 0,
            created_at: "2026-08-13T00:00:00.000Z"
          }],
          product_option_axes: []
        }]}
        view="products"
      />
    );

    await user.click(await screen.findByRole("button", { name: "Add" }));

    await waitFor(() => expect(syncedBodies).toHaveLength(1));
    expect(syncedBodies[0]).toMatchObject({
      items: [{ productId: "digital-product", variantId: "digital-variant", quantity: 1 }]
    });
    expect(JSON.parse(window.localStorage.getItem("aha-cart:single-store") ?? "[]")).toEqual([
      { productId: "digital-product", variantId: "digital-variant", quantity: 1 }
    ]);
  });

  test("treats a zero-inventory digital product as in stock and labels its delivery", async () => {
    const user = userEvent.setup();
    render(
      <StorefrontPage
        store={{ id: "store-1", name: "Art Store", slug: "art-store" }}
        branding={{
          logo_path: null,
          primary_color: null,
          accent_color: null,
          theme_json: { productsFiltersDefaultOpen: true }
        }}
        settings={{
          support_email: "support@example.com",
          fulfillment_message: null,
          shipping_policy: null,
          return_policy: null,
          announcement: null,
          footer_tagline: null,
          footer_note: null,
          instagram_url: null,
          facebook_url: null,
          tiktok_url: null,
          email_capture_enabled: false,
          email_capture_heading: null,
          email_capture_description: null,
          email_capture_success_message: null,
          storefront_copy_json: null
        }}
        contentBlocks={[]}
        products={[{
          id: "digital-product",
          title: "Printable pack",
          description: "A printable pack.",
          slug: "printable-pack",
          image_urls: [],
          image_alt_text: null,
          seo_title: null,
          seo_description: null,
          is_featured: true,
          created_at: "2026-08-13T00:00:00.000Z",
          price_cents: 2400,
          inventory_qty: 0,
          product_type: "digital",
          product_variants: [{
            id: "digital-variant",
            title: "PDF bundle",
            image_urls: [],
            group_image_urls: [],
            option_values: {},
            price_cents: 2400,
            inventory_qty: 0,
            is_made_to_order: false,
            is_default: true,
            status: "active",
            sort_order: 0,
            created_at: "2026-08-13T00:00:00.000Z"
          }],
          product_option_axes: []
        }]}
        view="products"
      />
    );

    expect(screen.getByText("Instant digital delivery")).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Availability"), "in-stock");
    expect(screen.getByRole("link", { name: "Printable pack" })).toBeTruthy();
    expect(screen.queryByText("No products match your filters.")).toBeNull();
  });
  test("represents a digital product with its watermarked preview, never its own uploaded artwork", () => {
    function digitalProduct(overrides: Record<string, unknown>) {
      return {
        id: "product-digital",
        title: "Sunrise print",
        description: "A printable.",
        slug: "sunrise-print",
        image_urls: [],
        image_alt_text: null,
        seo_title: null,
        seo_description: null,
        is_featured: false,
        created_at: "2026-03-31T00:00:00.000Z",
        price_cents: 2500,
        inventory_qty: 0,
        product_type: "digital" as const,
        product_variants: [
          {
            id: "variant-digital",
            title: "Default",
            image_urls: [],
            group_image_urls: [],
            option_values: {},
            price_cents: 2500,
            inventory_qty: 0,
            is_made_to_order: false,
            is_default: true,
            status: "active" as const,
            sort_order: 0,
            created_at: "2026-03-31T00:00:00.000Z"
          }
        ],
        product_option_axes: [],
        ...overrides,
      };
    }

    const settings = {
      support_email: null, fulfillment_message: null, shipping_policy: null, return_policy: null,
      announcement: null, footer_tagline: null, footer_note: null, instagram_url: null,
      facebook_url: null, tiktok_url: null, email_capture_enabled: false, email_capture_heading: null,
      email_capture_description: null, email_capture_success_message: null, storefront_copy_json: null,
    };

    const { rerender } = render(
      <StorefrontPage
        store={{ id: "store-1", name: "Shop", slug: "shop" }}
        branding={null}
        settings={settings}
        contentBlocks={[]}
        products={[digitalProduct({ digital_summary: { publicPreviewUrl: "https://cdn.example.test/watermarked.jpg" } })]}
        view="products"
      />,
    );
    expect(screen.getByText("https://cdn.example.test/watermarked.jpg")).toBeTruthy();

    // Uploaded imagery is never shown for a digital product: it can be the
    // artwork being sold, and a listing image is one right-click from a free
    // copy. The watermarked preview stands in instead.
    rerender(
      <StorefrontPage
        store={{ id: "store-1", name: "Shop", slug: "shop" }}
        branding={null}
        settings={settings}
        contentBlocks={[]}
        products={[digitalProduct({
          image_urls: ["https://cdn.example.test/marketing.jpg"],
          digital_summary: { publicPreviewUrl: "https://cdn.example.test/watermarked.jpg" },
        })]}
        view="products"
      />,
    );
    expect(screen.queryByText("https://cdn.example.test/marketing.jpg")).toBeNull();
    expect(screen.getByText("https://cdn.example.test/watermarked.jpg")).toBeTruthy();
  });
});
