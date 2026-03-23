import { describe, expect, test } from "vitest";
import { buildStorefrontBrandMetadata } from "@/lib/storefront/metadata";

describe("buildStorefrontBrandMetadata", () => {
  test("uses storefront branding assets for icons and social previews", () => {
    const metadata = buildStorefrontBrandMetadata({
      title: "At Home Apothecary",
      description: "Handmade apothecary goods.",
      canonical: "https://myrivo.app/s/at-home-apothecary",
      branding: {
        logo_path: "https://cdn.example.com/logo.png",
        favicon_path: "https://cdn.example.com/favicon.png",
        apple_touch_icon_path: "https://cdn.example.com/apple.png",
        og_image_path: "https://cdn.example.com/og.png",
        twitter_image_path: "https://cdn.example.com/twitter.png",
        primary_color: null,
        accent_color: null,
        theme_json: null
      }
    });

    expect(metadata.icons).toEqual({
      icon: [{ url: "https://cdn.example.com/favicon.png" }],
      shortcut: ["https://cdn.example.com/favicon.png"],
      apple: [{ url: "https://cdn.example.com/apple.png" }]
    });
    expect(metadata.openGraph).toEqual(
      expect.objectContaining({
        title: "At Home Apothecary",
        description: "Handmade apothecary goods.",
        url: "https://myrivo.app/s/at-home-apothecary",
        images: [{ url: "https://cdn.example.com/og.png" }]
      })
    );
    expect(metadata.twitter).toEqual(
      expect.objectContaining({
        card: "summary_large_image",
        title: "At Home Apothecary",
        images: ["https://cdn.example.com/og.png"]
      })
    );
  });

  test("falls back to the logo when a favicon is not provided", () => {
    const metadata = buildStorefrontBrandMetadata({
      branding: {
        logo_path: "https://cdn.example.com/logo.png",
        favicon_path: null,
        apple_touch_icon_path: null,
        og_image_path: null,
        twitter_image_path: null,
        primary_color: null,
        accent_color: null,
        theme_json: null
      }
    });

    expect(metadata.icons).toEqual({
      icon: [{ url: "https://cdn.example.com/logo.png" }],
      shortcut: ["https://cdn.example.com/logo.png"],
      apple: [{ url: "https://cdn.example.com/logo.png" }]
    });
    expect(metadata.twitter).toEqual(
      expect.objectContaining({
        card: "summary"
      })
    );
  });
});
