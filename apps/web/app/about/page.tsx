import { notFound } from "next/navigation";
import { StorefrontAboutPage } from "@/components/storefront/storefront-about-page";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { createStorefrontRuntime } from "@/lib/storefront/runtime";
import { StorefrontRuntimeProvider } from "@/components/storefront/storefront-runtime-provider";

export const dynamic = "force-dynamic";

type AboutPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AboutPage({ searchParams }: AboutPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedStoreSlug = typeof resolvedSearchParams.store === "string" ? resolvedSearchParams.store : null;
  const data = await loadStorefrontData(requestedStoreSlug);

  if (!data) {
    notFound();
  }

  const runtime = createStorefrontRuntime({
    ...data,
    mode: "live",
    surface: "about"
  });

  return (
    <StorefrontRuntimeProvider runtime={runtime}>
      <StorefrontAboutPage
        store={data.store}
        viewer={data.viewer}
        branding={data.branding}
        settings={data.settings}
        contentBlocks={data.contentBlocks}
      />
    </StorefrontRuntimeProvider>
  );
}
