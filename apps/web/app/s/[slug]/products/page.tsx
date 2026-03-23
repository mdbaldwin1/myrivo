import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { generateMetadata as generateProductsMetadata } from "@/app/products/page";
import { StorefrontUnavailablePage } from "@/components/storefront/storefront-unavailable-page";
import { StorefrontPage } from "@/components/storefront/storefront-page";
import { StorefrontRuntimeProvider } from "@/components/storefront/storefront-runtime-provider";
import { isReviewsEnabledForStoreSlug } from "@/lib/reviews/feature-gating";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { createStorefrontRuntime } from "@/lib/storefront/runtime";
import { loadStorefrontUnavailableData } from "@/lib/storefront/unavailable";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return generateProductsMetadata({ searchParams: Promise.resolve({ store: slug }) });
}

export default async function StorefrontSlugProductsPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await loadStorefrontData(slug);

  if (!data) {
    const unavailable = await loadStorefrontUnavailableData(slug);
    if (unavailable) {
      return <StorefrontUnavailablePage state={unavailable} />;
    }
    notFound();
  }

  const runtime = createStorefrontRuntime({
    ...data,
    mode: "live",
    surface: "products"
  });

  return (
    <StorefrontRuntimeProvider runtime={runtime}>
      <StorefrontPage
        store={data.store}
        viewer={data.viewer}
        branding={data.branding}
        settings={data.settings}
        contentBlocks={data.contentBlocks}
        products={data.products}
        view="products"
        reviewsEnabled={isReviewsEnabledForStoreSlug(data.store.slug)}
      />
    </StorefrontRuntimeProvider>
  );
}
