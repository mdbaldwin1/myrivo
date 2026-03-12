import { notFound } from "next/navigation";
import { StorefrontCheckoutPage } from "@/components/storefront/storefront-checkout-page";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { createStorefrontRuntime } from "@/lib/storefront/runtime";
import { StorefrontRuntimeProvider } from "@/components/storefront/storefront-runtime-provider";

export const dynamic = "force-dynamic";

type CheckoutPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedStoreSlug = typeof resolvedSearchParams.store === "string" ? resolvedSearchParams.store : null;
  const data = await loadStorefrontData(requestedStoreSlug);

  if (!data) {
    notFound();
  }

  const runtime = createStorefrontRuntime({
    ...data,
    mode: "live",
    surface: "checkout"
  });

  return (
    <StorefrontRuntimeProvider runtime={runtime}>
      <StorefrontCheckoutPage store={data.store} viewer={data.viewer} branding={data.branding} settings={data.settings} />
    </StorefrontRuntimeProvider>
  );
}
