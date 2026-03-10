import { notFound } from "next/navigation";
import { StorefrontPoliciesPage } from "@/components/storefront/storefront-policies-page";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";

export const dynamic = "force-dynamic";

type PoliciesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PoliciesPage({ searchParams }: PoliciesPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedStoreSlug = typeof resolvedSearchParams.store === "string" ? resolvedSearchParams.store : null;
  const data = await loadStorefrontData(requestedStoreSlug);
  if (!data) {
    notFound();
  }

  return (
    <StorefrontPoliciesPage
      store={data.store}
      viewer={data.viewer}
      branding={data.branding}
      settings={data.settings}
    />
  );
}
