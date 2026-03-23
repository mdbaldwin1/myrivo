import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { StorefrontUnavailablePage } from "@/components/storefront/storefront-unavailable-page";
import { StorefrontPage } from "@/components/storefront/storefront-page";
import { StorefrontRuntimeProvider } from "@/components/storefront/storefront-runtime-provider";
import { isReviewsEnabledForStoreSlug } from "@/lib/reviews/feature-gating";
import { buildSearchSuffix } from "@/lib/storefront/legacy-query";
import { buildStorefrontProductsPath } from "@/lib/storefront/paths";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { createStorefrontRuntime } from "@/lib/storefront/runtime";
import { buildStorefrontCanonicalUrl, resolveStorefrontCanonicalRedirect } from "@/lib/storefront/seo";
import { loadStorefrontUnavailableData } from "@/lib/storefront/unavailable";

export const dynamic = "force-dynamic";

type ProductsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: ProductsPageProps): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const requestedStoreSlug = typeof resolvedSearchParams.store === "string" ? resolvedSearchParams.store : null;
  const data = await loadStorefrontData(requestedStoreSlug);
  if (!data) {
    const unavailable = await loadStorefrontUnavailableData(requestedStoreSlug);
    if (unavailable) {
      return {
        title: `${unavailable.store.name} | ${unavailable.kind === "offline" ? "Temporarily Offline" : "Coming Soon"}`
      };
    }
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
  const requestHeaders = await headers();
  const currentPath = requestHeaders.get("x-pathname") ?? requestHeaders.get("next-url") ?? "";
  const disableStoreCanonicalRedirect = /^\/s\//.test(currentPath);
  const requestedStoreSlug = typeof resolvedSearchParams.store === "string" ? resolvedSearchParams.store : null;
  if (requestedStoreSlug && !disableStoreCanonicalRedirect) {
    redirect(`${buildStorefrontProductsPath(requestedStoreSlug)}${buildSearchSuffix(resolvedSearchParams, ["store"])}`);
  }
  const redirectUrl = await resolveStorefrontCanonicalRedirect("/products", requestedStoreSlug);
  if (redirectUrl) {
    redirect(redirectUrl);
  }
  const data = await loadStorefrontData(requestedStoreSlug);

  if (!data) {
    const unavailable = await loadStorefrontUnavailableData(requestedStoreSlug);
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
