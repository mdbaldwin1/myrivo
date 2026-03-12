import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { StorefrontPage } from "@/components/storefront/storefront-page";
import { StorefrontRuntimeProvider } from "@/components/storefront/storefront-runtime-provider";
import { isReviewsEnabledForStoreSlug } from "@/lib/reviews/feature-gating";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { createStorefrontRuntime } from "@/lib/storefront/runtime";
import { buildStorefrontCanonicalUrl, resolveStorefrontCanonicalRedirect } from "@/lib/storefront/seo";

export const dynamic = "force-dynamic";

type ProductsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: ProductsPageProps): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const requestedStoreSlug = typeof resolvedSearchParams.store === "string" ? resolvedSearchParams.store : null;
  const data = await loadStorefrontData(requestedStoreSlug);
  if (!data) {
    return {
      title: "Products | Myrivo"
    };
  }

  const canonical = await buildStorefrontCanonicalUrl("/products", requestedStoreSlug);
  return {
    title: `${data.settings?.seo_title || data.store.name} Products`,
    description: data.settings?.seo_description || `Browse products from ${data.store.name}.`,
    alternates: {
      canonical
    },
    robots: data.settings?.seo_noindex ? { index: false, follow: false } : undefined
  };
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedStoreSlug = typeof resolvedSearchParams.store === "string" ? resolvedSearchParams.store : null;
  const redirectUrl = await resolveStorefrontCanonicalRedirect("/products", requestedStoreSlug);
  if (redirectUrl) {
    redirect(redirectUrl);
  }
  const data = await loadStorefrontData(requestedStoreSlug);

  if (!data) {
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
