import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { StorefrontUnavailablePage } from "@/components/storefront/storefront-unavailable-page";
import { StorefrontAboutPage } from "@/components/storefront/storefront-about-page";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { buildSearchSuffix } from "@/lib/storefront/legacy-query";
import { buildStorefrontAboutPath } from "@/lib/storefront/paths";
import { createStorefrontRuntime } from "@/lib/storefront/runtime";
import { loadStorefrontUnavailableData } from "@/lib/storefront/unavailable";
import { StorefrontRuntimeProvider } from "@/components/storefront/storefront-runtime-provider";

export const dynamic = "force-dynamic";

type AboutPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AboutPage({ searchParams }: AboutPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const currentPath = requestHeaders.get("x-pathname") ?? requestHeaders.get("next-url") ?? "";
  const disableStoreCanonicalRedirect = /^\/s\//.test(currentPath);
  const requestedStoreSlug = typeof resolvedSearchParams.store === "string" ? resolvedSearchParams.store : null;
  if (requestedStoreSlug && !disableStoreCanonicalRedirect) {
    redirect(`${buildStorefrontAboutPath(requestedStoreSlug)}${buildSearchSuffix(resolvedSearchParams, ["store"])}`);
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
