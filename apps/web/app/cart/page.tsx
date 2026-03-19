import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { StorefrontUnavailablePage } from "@/components/storefront/storefront-unavailable-page";
import { StorefrontCartPage } from "@/components/storefront/storefront-cart-page";
import { buildSearchSuffix } from "@/lib/storefront/legacy-query";
import { buildStorefrontCartPath } from "@/lib/storefront/paths";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { createStorefrontRuntime } from "@/lib/storefront/runtime";
import { loadStorefrontUnavailableData } from "@/lib/storefront/unavailable";
import { StorefrontRuntimeProvider } from "@/components/storefront/storefront-runtime-provider";

export const dynamic = "force-dynamic";

type CartPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CartPage({ searchParams }: CartPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const currentPath = requestHeaders.get("x-pathname") ?? requestHeaders.get("next-url") ?? "";
  const disableStoreCanonicalRedirect = /^\/s\//.test(currentPath);
  const requestedStoreSlug = typeof resolvedSearchParams.store === "string" ? resolvedSearchParams.store : null;
  if (requestedStoreSlug && !disableStoreCanonicalRedirect) {
    redirect(`${buildStorefrontCartPath(requestedStoreSlug)}${buildSearchSuffix(resolvedSearchParams, ["store"])}`);
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
    surface: "cart"
  });

  return (
    <StorefrontRuntimeProvider runtime={runtime}>
      <StorefrontCartPage store={data.store} viewer={data.viewer} branding={data.branding} settings={data.settings} products={data.products} />
    </StorefrontRuntimeProvider>
  );
}
