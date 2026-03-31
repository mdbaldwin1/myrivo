import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildStorefrontBrandMetadata } from "@/lib/storefront/metadata";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { loadStorefrontUnavailableData } from "@/lib/storefront/unavailable";

type StorefrontSlugLayoutProps = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: StorefrontSlugLayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadStorefrontData(slug);

  if (data) {
    return buildStorefrontBrandMetadata({
      branding: data.branding
    });
  }

  const unavailable = await loadStorefrontUnavailableData(slug);
  if (unavailable) {
    return buildStorefrontBrandMetadata({
      branding: unavailable.branding
    });
  }

  return {};
}

export default function StorefrontSlugLayout({ children }: StorefrontSlugLayoutProps) {
  return children;
}
