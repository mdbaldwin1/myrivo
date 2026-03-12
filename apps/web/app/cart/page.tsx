import { notFound } from "next/navigation";
import { StorefrontCartPage } from "@/components/storefront/storefront-cart-page";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { createStorefrontRuntime } from "@/lib/storefront/runtime";
import { StorefrontRuntimeProvider } from "@/components/storefront/storefront-runtime-provider";

export const dynamic = "force-dynamic";

type CartPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CartPage({ searchParams }: CartPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedStoreSlug = typeof resolvedSearchParams.store === "string" ? resolvedSearchParams.store : null;
  const data = await loadStorefrontData(requestedStoreSlug);
  if (!data) {
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
