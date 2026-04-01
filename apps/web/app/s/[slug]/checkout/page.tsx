import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StorefrontUnavailablePage } from "@/components/storefront/storefront-unavailable-page";
import { StorefrontCheckoutPage } from "@/components/storefront/storefront-checkout-page";
import { StorefrontRuntimeProvider } from "@/components/storefront/storefront-runtime-provider";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { createStorefrontRuntime } from "@/lib/storefront/runtime";
import { loadStorefrontUnavailableData } from "@/lib/storefront/unavailable";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadStorefrontData(slug);

  if (!data) {
    const unavailable = await loadStorefrontUnavailableData(slug);
    if (unavailable) {
      return {
        title: `${unavailable.store.name} | ${unavailable.kind === "offline" ? "Temporarily Offline" : "Coming Soon"}`
      };
    }

    return {
      title: "Checkout | Myrivo"
    };
  }

  return {
    title: `${data.store.name} Checkout`,
    description: `Complete your order with ${data.store.name}.`
  };
}

export default async function StorefrontSlugCheckoutPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  await searchParams;
  const data = await loadStorefrontData(slug);

  if (!data) {
    const unavailable = await loadStorefrontUnavailableData(slug);
    if (unavailable) {
      return <StorefrontUnavailablePage state={unavailable} />;
    }
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
