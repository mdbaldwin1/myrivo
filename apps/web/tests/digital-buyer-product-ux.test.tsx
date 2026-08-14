/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { StorefrontProductDetailPage } from "@/components/storefront/storefront-product-detail-page";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  )
}));

vi.mock("@/components/storefront/storefront-header", () => ({ StorefrontHeader: () => <div>Header</div> }));
vi.mock("@/components/storefront/storefront-cart-button", () => ({ StorefrontCartButton: () => <div>Cart</div> }));
vi.mock("@/components/storefront/storefront-footer", () => ({ StorefrontFooter: () => <div>Footer</div> }));
vi.mock("@/components/storefront/storefront-reviews-section", () => ({ StorefrontReviewsSection: () => null }));
vi.mock("@/components/storefront/storefront-image-carousel", () => ({
  StorefrontImageCarousel: ({ images }: { images: string[] }) => <div data-testid="carousel">{images.join("|")}</div>
}));
vi.mock("@/components/storefront/storefront-runtime-provider", () => ({ useOptionalStorefrontRuntime: () => null }));
vi.mock("@/components/dashboard/storefront-studio-document-provider", () => ({ useOptionalStorefrontStudioDocument: () => null }));
vi.mock("@/components/storefront/storefront-analytics-provider", () => ({ useOptionalStorefrontAnalytics: () => null }));
vi.mock("@/components/storefront/use-storefront-analytics-events", () => ({
  useStorefrontPageView: () => undefined,
  useStorefrontProductView: () => undefined
}));

afterEach(() => cleanup());

describe("digital buyer product detail", () => {
  test("shows the selected bundle and only its public watermarked preview", async () => {
    const user = userEvent.setup();
    render(
      <StorefrontProductDetailPage
        store={{ id: "store-1", name: "Art Store", slug: "art-store" }}
        branding={null}
        settings={{
          announcement: null,
          fulfillment_message: "Ships in a week",
          support_email: "help@example.test",
          footer_tagline: null,
          footer_note: null,
          instagram_url: null,
          facebook_url: null,
          tiktok_url: null,
          storefront_copy_json: null
        }}
        product={{
          id: "digital-product",
          title: "Botanical print set",
          description: "A printable set.",
          slug: "botanical-print-set",
          image_urls: ["https://cdn.example.test/unwatermarked.jpg"],
          image_alt_text: "Botanical set preview",
          seo_title: null,
          seo_description: null,
          is_featured: false,
          product_type: "digital",
          created_at: "2026-08-13T00:00:00.000Z",
          digital_summary: {
            publicPreviewUrl: "https://cdn.example.test/watermarked.jpg",
            files: [
              { variantId: null, label: "Printing guide", format: "PDF" },
              { variantId: "variant-a4", label: "A4 artwork", format: "PNG" },
              { variantId: "variant-letter", label: "US Letter artwork", format: "JPG" }
            ]
          },
          product_variants: [
            {
              id: "variant-a4",
              title: "A4",
              option_values: { Size: "A4" },
              price_cents: 2400,
              inventory_qty: 0,
              is_made_to_order: true,
              is_default: true,
              status: "active",
              sort_order: 0,
              created_at: "2026-08-13T00:00:00.000Z"
            },
            {
              id: "variant-letter",
              title: "US Letter",
              option_values: { Size: "US Letter" },
              price_cents: 2400,
              inventory_qty: 0,
              is_made_to_order: true,
              is_default: false,
              status: "active",
              sort_order: 1,
              created_at: "2026-08-13T00:00:00.000Z"
            }
          ],
          product_option_axes: [{
            id: "size",
            name: "Size",
            sort_order: 0,
            is_required: true,
            product_option_values: [
              { id: "a4", value: "A4", sort_order: 0, is_active: true },
              { id: "letter", value: "US Letter", sort_order: 1, is_active: true }
            ]
          }]
        }}
        reviewsEnabled={false}
      />
    );

    expect(screen.getByText("Digital download")).toBeTruthy();
    expect(screen.getByText("2 files included · PDF, PNG")).toBeTruthy();
    expect(screen.getByText("Printing guide")).toBeTruthy();
    expect(screen.getByText("A4 artwork")).toBeTruthy();
    expect(screen.queryByText("US Letter artwork")).toBeNull();
    expect(screen.getByTestId("carousel").textContent).toBe("https://cdn.example.test/watermarked.jpg");
    expect(screen.queryByText("Ships in a week")).toBeNull();
    expect(screen.queryByText("Quantity")).toBeNull();
    expect(screen.getByRole("link", { name: "Personal-use license" }).getAttribute("href")).toBe(
      "/legal/digital-personal-use-license"
    );

    await user.click(screen.getByRole("button", { name: "US Letter" }));
    expect(screen.getByText("2 files included · PDF, JPG")).toBeTruthy();
    expect(screen.getByText("US Letter artwork")).toBeTruthy();
    expect(screen.queryByText("A4 artwork")).toBeNull();
  });
});
