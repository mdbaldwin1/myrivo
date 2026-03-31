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
});
