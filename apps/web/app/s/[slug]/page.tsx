import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { StorefrontPage } from "@/components/storefront/storefront-page";
import { StorefrontRuntimeProvider } from "@/components/storefront/storefront-runtime-provider";
import { isReviewsEnabledForStoreSlug } from "@/lib/reviews/feature-gating";
import { buildReviewSummary, listPublishedReviews } from "@/lib/reviews/read";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { createStorefrontRuntime } from "@/lib/storefront/runtime";
import { buildAggregateRatingSchema, buildReviewSchemaList, resolveStorefrontReviewSeoConfig } from "@/lib/storefront/reviews-seo";
import { buildStorefrontCanonicalUrl, resolveStorefrontCanonicalRedirect } from "@/lib/storefront/seo";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isMissingRelationInSchemaCache } from "@/lib/supabase/error-classifiers";

export const dynamic = "force-dynamic";

type StorefrontRouteParams = {
  params: Promise<{ slug: string }>;
};

function buildPublicLocationLabel(settings: {
  seo_location_city?: string | null;
  seo_location_region?: string | null;
  seo_location_state?: string | null;
}) {
  const parts = [settings.seo_location_city, settings.seo_location_region, settings.seo_location_state]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : null;
}

export async function generateMetadata({ params }: StorefrontRouteParams): Promise<Metadata> {
  const resolvedParams = await params;
  const data = await loadStorefrontData(resolvedParams.slug);
  if (!data) {
    return {
      title: "Storefront | Myrivo"
    };
  }

  const canonical = await buildStorefrontCanonicalUrl("/", resolvedParams.slug);
  const publicLocation = buildPublicLocationLabel(data.settings ?? {});

  return {
    title: data.settings?.seo_title || data.store.name,
    description:
      data.settings?.seo_description ||
      data.settings?.announcement ||
      (publicLocation ? `Shop ${data.store.name} in ${publicLocation}.` : `Shop ${data.store.name}.`),
    alternates: {
      canonical
    },
    robots: data.settings?.seo_noindex ? { index: false, follow: false } : undefined
  };
}

export default async function StorefrontSlugPage({ params }: StorefrontRouteParams) {
  const resolvedParams = await params;
  const redirectUrl = await resolveStorefrontCanonicalRedirect("/", resolvedParams.slug);
  if (redirectUrl) {
    redirect(redirectUrl);
  }
  const data = await loadStorefrontData(resolvedParams.slug);
  if (!data) {
    notFound();
  }

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: data.store.name,
    url: await buildStorefrontCanonicalUrl("/", data.store.slug),
    potentialAction: {
      "@type": "SearchAction",
      target: `${await buildStorefrontCanonicalUrl("/products", data.store.slug)}?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: data.store.name,
    url: await buildStorefrontCanonicalUrl("/", data.store.slug),
    logo: data.branding?.logo_path ?? undefined
  };
  const publicLocation = buildPublicLocationLabel(data.settings ?? {});
  const reviewsEnabled = isReviewsEnabledForStoreSlug(data.store.slug);
  const reviewSeoConfig = resolveStorefrontReviewSeoConfig();
  let storeSummary: Awaited<ReturnType<typeof buildReviewSummary>> | null = null;
  let storeReviews: Awaited<ReturnType<typeof listPublishedReviews>>["items"] = [];
  if (reviewsEnabled) {
    try {
      const admin = createSupabaseAdminClient();
      const [summary, recent] = await Promise.all([
        buildReviewSummary(admin, { storeId: data.store.id, productId: null, verifiedOnly: false, hasMedia: false }),
        listPublishedReviews(admin, {
          storeId: data.store.id,
          productId: null,
          sort: "newest",
          limit: reviewSeoConfig.maxRecentReviews,
          offset: 0
        })
      ]);
      storeSummary = summary;
      storeReviews = recent.items;
    } catch (error) {
      if (!isMissingRelationInSchemaCache(error as { code?: string; message?: string })) {
        console.warn("Failed to resolve storefront review schema payload.", error);
      }
    }
  }

  const localBusinessSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: data.store.name,
    url: await buildStorefrontCanonicalUrl("/", data.store.slug),
    image: data.branding?.logo_path ?? undefined,
    areaServed: publicLocation ?? undefined
  };
  const aggregateRating = storeSummary ? buildAggregateRatingSchema(storeSummary, reviewSeoConfig.minReviewCount) : undefined;
  if (aggregateRating) {
    localBusinessSchema.aggregateRating = aggregateRating;
  }
  if (aggregateRating && storeReviews.length > 0) {
    localBusinessSchema.review = buildReviewSchemaList(
      storeReviews.map((item) => ({
        rating: item.rating,
        title: item.title,
        body: item.body,
        reviewerName: item.reviewerName,
        createdAt: item.publishedAt ?? item.createdAt
      })),
      reviewSeoConfig.maxRecentReviews
    );
  }
  if (data.settings?.seo_location_show_full_address && data.settings?.seo_location_address_line1) {
    localBusinessSchema.address = {
      "@type": "PostalAddress",
      streetAddress: data.settings.seo_location_address_line1,
      addressLocality: data.settings.seo_location_city ?? undefined,
      addressRegion: data.settings.seo_location_state ?? undefined,
      postalCode: data.settings.seo_location_postal_code ?? undefined,
      addressCountry: data.settings.seo_location_country_code ?? undefined
    };
  }

  const runtime = createStorefrontRuntime({
    ...data,
    mode: "live",
    surface: "home"
  });

  return (
    <StorefrontRuntimeProvider runtime={runtime}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }} />
      <StorefrontPage
        store={data.store}
        viewer={data.viewer}
        branding={data.branding}
        settings={data.settings}
        contentBlocks={data.contentBlocks}
        products={data.products}
        view="home"
        reviewsEnabled={reviewsEnabled}
      />
    </StorefrontRuntimeProvider>
  );
}
