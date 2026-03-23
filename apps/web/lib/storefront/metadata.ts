import type { Metadata } from "next";
import type { StorefrontBranding } from "@/lib/storefront/runtime";

type BuildStorefrontBrandMetadataInput = {
  title?: string | null;
  description?: string | null;
  canonical?: string | null;
  branding?: StorefrontBranding;
};

export function buildStorefrontBrandMetadata(input: BuildStorefrontBrandMetadataInput): Metadata {
  const favicon = input.branding?.favicon_path?.trim() || input.branding?.logo_path?.trim() || null;
  const appleTouchIcon = input.branding?.apple_touch_icon_path?.trim() || favicon;
  const socialImage = input.branding?.og_image_path?.trim() || input.branding?.twitter_image_path?.trim() || null;

  return {
    title: input.title ?? undefined,
    description: input.description ?? undefined,
    alternates: input.canonical
      ? {
          canonical: input.canonical
        }
      : undefined,
    icons: favicon
      ? {
          icon: [{ url: favicon }],
          shortcut: [favicon],
          apple: appleTouchIcon ? [{ url: appleTouchIcon }] : undefined
        }
      : undefined,
    openGraph: {
      title: input.title ?? undefined,
      description: input.description ?? undefined,
      url: input.canonical ?? undefined,
      type: "website",
      images: socialImage ? [{ url: socialImage }] : undefined
    },
    twitter: {
      card: socialImage ? "summary_large_image" : "summary",
      title: input.title ?? undefined,
      description: input.description ?? undefined,
      images: socialImage ? [socialImage] : undefined
    }
  };
}
