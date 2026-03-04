import { notFound } from "next/navigation";
import { StorefrontProductDetailPage } from "@/components/storefront/storefront-product-detail-page";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ productId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductDetailPage({ params, searchParams }: Params) {
  const resolvedSearchParams = await searchParams;
  const requestedStoreSlug = typeof resolvedSearchParams.store === "string" ? resolvedSearchParams.store : null;
  const data = await loadStorefrontData(requestedStoreSlug);
  if (!data) {
    notFound();
  }

  const resolvedParams = await params;
  const product = data.products.find((entry) => entry.id === resolvedParams.productId);
  if (!product) {
    notFound();
  }

  return <StorefrontProductDetailPage store={data.store} branding={data.branding} settings={data.settings} product={product} />;
}
