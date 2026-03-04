import { notFound } from "next/navigation";
import { StorefrontPage } from "@/components/storefront/storefront-page";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";

export const dynamic = "force-dynamic";

type StorefrontRouteParams = {
  params: Promise<{ slug: string }>;
};

export default async function StorefrontSlugPage({ params }: StorefrontRouteParams) {
  const resolvedParams = await params;
  const data = await loadStorefrontData(resolvedParams.slug);
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
      view="home"
    />
  );
}
