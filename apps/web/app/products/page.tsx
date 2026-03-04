import { notFound } from "next/navigation";
import { StorefrontPage } from "@/components/storefront/storefront-page";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";

export const dynamic = "force-dynamic";

type ProductsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedStoreSlug = typeof resolvedSearchParams.store === "string" ? resolvedSearchParams.store : null;
  const data = await loadStorefrontData(requestedStoreSlug);

  if (!data) {
    notFound();
  }

  return (
    <StorefrontPage
      store={data.store}
      branding={data.branding}
      settings={data.settings}
      contentBlocks={data.contentBlocks}
      products={data.products}
      view="products"
    />
  );
}
