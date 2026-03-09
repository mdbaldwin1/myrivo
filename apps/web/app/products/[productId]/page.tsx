import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { StorefrontProductDetailPage } from "@/components/storefront/storefront-product-detail-page";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { buildStorefrontCanonicalUrl, resolveStorefrontCanonicalRedirect } from "@/lib/storefront/seo";

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
  const requestedStoreSlug = typeof resolvedSearchParams.store === "string" ? resolvedSearchParams.store : null;
  const resolvedParams = await params;
  const redirectUrl = await resolveStorefrontCanonicalRedirect(`/products/${resolvedParams.productId}`, requestedStoreSlug);
  if (redirectUrl) {
    redirect(redirectUrl);
  }
  const data = await loadStorefrontData(requestedStoreSlug);
  if (!data) {
    notFound();
  }

  const product = data.products.find((entry) => entry.id === resolvedParams.productId || entry.slug === resolvedParams.productId);
  if (!product) {
    notFound();
  }
  if (product.slug && resolvedParams.productId !== product.slug) {
    const suffix = requestedStoreSlug ? `?store=${encodeURIComponent(requestedStoreSlug)}` : "";
    redirect(`/products/${product.slug}${suffix}`);
  }

  const canonical = await buildStorefrontCanonicalUrl(`/products/${product.slug || product.id}`, requestedStoreSlug);
  const defaultVariant = product.product_variants.find((variant) => variant.is_default) ?? product.product_variants[0] ?? null;
  const productImage = (defaultVariant?.image_urls?.[0] ?? defaultVariant?.group_image_urls?.[0] ?? product.image_urls?.[0] ?? null) as string | null;
  const productSchema = {
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
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: await buildStorefrontCanonicalUrl("/", requestedStoreSlug) },
      { "@type": "ListItem", position: 2, name: "Products", item: await buildStorefrontCanonicalUrl("/products", requestedStoreSlug) },
      { "@type": "ListItem", position: 3, name: product.title, item: canonical }
    ]
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <StorefrontProductDetailPage store={data.store} viewer={data.viewer} branding={data.branding} settings={data.settings} product={product} />
    </>
  );
}
