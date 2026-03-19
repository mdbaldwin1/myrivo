import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { StorefrontUnavailablePage } from "@/components/storefront/storefront-unavailable-page";
import { StorefrontProductDetailPage } from "@/components/storefront/storefront-product-detail-page";
import { StorefrontRuntimeProvider } from "@/components/storefront/storefront-runtime-provider";
import { isReviewsEnabledForStoreSlug } from "@/lib/reviews/feature-gating";
import { buildReviewSummary, listPublishedReviews } from "@/lib/reviews/read";
import { buildSearchSuffix } from "@/lib/storefront/legacy-query";
import { buildStorefrontProductPath } from "@/lib/storefront/paths";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { createStorefrontRuntime } from "@/lib/storefront/runtime";
import { buildAggregateRatingSchema, buildReviewSchemaList, resolveStorefrontReviewSeoConfig } from "@/lib/storefront/reviews-seo";
import { buildStorefrontCanonicalUrl, resolveStorefrontCanonicalRedirect } from "@/lib/storefront/seo";
import { loadStorefrontUnavailableData } from "@/lib/storefront/unavailable";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isMissingRelationInSchemaCache } from "@/lib/supabase/error-classifiers";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ productId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getProductDescription(description: string) {
  const plain = description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!plain) {
    return "Product details";
  }
  if (plain.length <= 160) {
    return plain;
  }
  return `${plain.slice(0, 157)}...`;
}

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const requestedStoreSlug = typeof resolvedSearchParams.store === "string" ? resolvedSearchParams.store : null;
  const resolvedParams = await params;
  const data = await loadStorefrontData(requestedStoreSlug);
  if (!data) {
    const unavailable = await loadStorefrontUnavailableData(requestedStoreSlug);
    if (unavailable) {
      return {
        title: `${unavailable.store.name} | ${unavailable.kind === "offline" ? "Temporarily Offline" : "Coming Soon"}`
      };
    }
    return {
      title: "Product | Myrivo"
    };
  }

  const product = data.products.find((entry) => entry.id === resolvedParams.productId);
  const resolvedProduct = product ?? data.products.find((entry) => entry.slug === resolvedParams.productId);
  if (!resolvedProduct) {
    return {
      title: `${data.store.name} Product`
    };
  }

  const canonical = await buildStorefrontCanonicalUrl(`/products/${resolvedProduct.slug || resolvedProduct.id}`, requestedStoreSlug);

  return {
    title: `${resolvedProduct.seo_title || resolvedProduct.title} | ${data.store.name}`,
    description: resolvedProduct.seo_description || getProductDescription(resolvedProduct.description),
    alternates: {
      canonical
    },
    robots: data.settings?.seo_noindex ? { index: false, follow: false } : undefined
  };
}

export default async function ProductDetailPage({ params, searchParams }: Params) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const currentPath = requestHeaders.get("x-pathname") ?? requestHeaders.get("next-url") ?? "";
  const disableStoreCanonicalRedirect = /^\/s\//.test(currentPath);
  const requestedStoreSlug = typeof resolvedSearchParams.store === "string" ? resolvedSearchParams.store : null;
  const resolvedParams = await params;
  if (requestedStoreSlug && !disableStoreCanonicalRedirect) {
    redirect(
      `${buildStorefrontProductPath(requestedStoreSlug, resolvedParams.productId)}${buildSearchSuffix(resolvedSearchParams, ["store"])}`
    );
  }
  const redirectUrl = await resolveStorefrontCanonicalRedirect(`/products/${resolvedParams.productId}`, requestedStoreSlug);
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

  const product = data.products.find((entry) => entry.id === resolvedParams.productId || entry.slug === resolvedParams.productId);
  if (!product) {
    notFound();
  }
  if (product.slug && resolvedParams.productId !== product.slug) {
    if (requestedStoreSlug) {
      redirect(buildStorefrontProductPath(requestedStoreSlug, product.slug));
    }
    redirect(`/products/${product.slug}`);
  }

  const canonical = await buildStorefrontCanonicalUrl(`/products/${product.slug || product.id}`, requestedStoreSlug);
  const reviewsEnabled = isReviewsEnabledForStoreSlug(data.store.slug);
  const reviewSeoConfig = resolveStorefrontReviewSeoConfig();
  let productSummary: Awaited<ReturnType<typeof buildReviewSummary>> | null = null;
  let productReviews: Awaited<ReturnType<typeof listPublishedReviews>>["items"] = [];
  if (reviewsEnabled) {
    try {
      const admin = createSupabaseAdminClient();
      const [summary, recent] = await Promise.all([
        buildReviewSummary(admin, { storeId: data.store.id, productId: product.id, verifiedOnly: false, hasMedia: false }),
        listPublishedReviews(admin, {
          storeId: data.store.id,
          productId: product.id,
          sort: "newest",
          limit: reviewSeoConfig.maxRecentReviews,
          offset: 0
        })
      ]);
      productSummary = summary;
      productReviews = recent.items;
    } catch (error) {
      if (!isMissingRelationInSchemaCache(error as { code?: string; message?: string })) {
        console.warn("Failed to resolve product review schema payload.", error);
      }
    }
  }
  const defaultVariant = product.product_variants.find((variant) => variant.is_default) ?? product.product_variants[0] ?? null;
  const productImage = (defaultVariant?.image_urls?.[0] ?? defaultVariant?.group_image_urls?.[0] ?? product.image_urls?.[0] ?? null) as string | null;
  const productSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.seo_title || product.title,
    description: product.seo_description || getProductDescription(product.description),
    image: productImage ? [productImage] : undefined,
    sku: defaultVariant?.id ?? product.id,
    brand: {
      "@type": "Brand",
      name: data.store.name
    },
    offers: {
      "@type": "Offer",
      url: canonical,
      priceCurrency: "USD",
      price: ((defaultVariant?.price_cents ?? product.price_cents) / 100).toFixed(2),
      availability: (defaultVariant?.inventory_qty ?? product.inventory_qty) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
    }
  };
  const aggregateRating = productSummary ? buildAggregateRatingSchema(productSummary, reviewSeoConfig.minReviewCount) : undefined;
  if (aggregateRating) {
    productSchema.aggregateRating = aggregateRating;
  }
  if (aggregateRating && productReviews.length > 0) {
    productSchema.review = buildReviewSchemaList(
      productReviews.map((item) => ({
        rating: item.rating,
        title: item.title,
        body: item.body,
        reviewerName: item.reviewerName,
        createdAt: item.publishedAt ?? item.createdAt
      })),
      reviewSeoConfig.maxRecentReviews
    );
  }
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: await buildStorefrontCanonicalUrl("/", requestedStoreSlug) },
      { "@type": "ListItem", position: 2, name: "Products", item: await buildStorefrontCanonicalUrl("/products", requestedStoreSlug) },
      { "@type": "ListItem", position: 3, name: product.title, item: canonical }
    ]
  };

  const runtime = createStorefrontRuntime({
    ...data,
    mode: "live",
    surface: "productDetail"
  });

  return (
    <StorefrontRuntimeProvider runtime={runtime}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <StorefrontProductDetailPage
        store={data.store}
        viewer={data.viewer}
        branding={data.branding}
        settings={data.settings}
        product={product}
        reviewsEnabled={reviewsEnabled}
      />
    </StorefrontRuntimeProvider>
  );
}
