import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StorefrontUnavailablePage } from "@/components/storefront/storefront-unavailable-page";
import { StorefrontCartPage } from "@/components/storefront/storefront-cart-page";
import { StorefrontRuntimeProvider } from "@/components/storefront/storefront-runtime-provider";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { createStorefrontRuntime } from "@/lib/storefront/runtime";
import { loadStorefrontUnavailableData } from "@/lib/storefront/unavailable";

type PageProps = {
  params: Promise<{ slug: string }>;
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
      title: "Cart | Myrivo"
    };
  }

  return {
    title: `${data.store.name} Cart`,
    description: `Review the items in your cart from ${data.store.name}.`
  };
}

export default async function StorefrontSlugCartPage({ params }: PageProps) {
  const { slug } = await params;
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
    surface: "cart"
  });

  return (
    <StorefrontRuntimeProvider runtime={runtime}>
      <StorefrontCartPage store={data.store} viewer={data.viewer} branding={data.branding} settings={data.settings} products={data.products} />
    </StorefrontRuntimeProvider>
  );
}
