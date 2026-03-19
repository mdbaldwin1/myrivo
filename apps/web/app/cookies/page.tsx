import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CookiePolicyContent } from "@/components/privacy/cookie-policy-content";
import { PageShell } from "@/components/layout/page-shell";
import { StorefrontUnavailablePage } from "@/components/storefront/storefront-unavailable-page";
import { StorefrontCookiePolicyPage } from "@/components/storefront/storefront-cookie-policy-page";
import { StorefrontRuntimeProvider } from "@/components/storefront/storefront-runtime-provider";
import { buildSearchSuffix } from "@/lib/storefront/legacy-query";
import { buildStorefrontCookiesPath } from "@/lib/storefront/paths";
import { buildStorefrontCanonicalUrl } from "@/lib/storefront/seo";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { createStorefrontRuntime } from "@/lib/storefront/runtime";
import { resolveStoreSlugFromDomain } from "@/lib/stores/domain-store";
import { loadStorefrontUnavailableData } from "@/lib/storefront/unavailable";

export const dynamic = "force-dynamic";

type CookiesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function resolveRequestedStoreSlug(searchParams: Record<string, string | string[] | undefined>) {
  const explicit = typeof searchParams.store === "string" ? searchParams.store : null;
  if (explicit?.trim()) {
    return explicit.trim();
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  return resolveStoreSlugFromDomain(host, { includeNonPublic: true });
}

export async function generateMetadata({ searchParams }: CookiesPageProps): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const requestedStoreSlug = await resolveRequestedStoreSlug(resolvedSearchParams);
  if (!requestedStoreSlug) {
    return {
      title: "Cookie Policy | Myrivo"
    };
  }

  const data = await loadStorefrontData(requestedStoreSlug);
  if (!data) {
    const unavailable = await loadStorefrontUnavailableData(requestedStoreSlug);
    if (unavailable) {
      return {
        title: `${unavailable.store.name} | ${unavailable.kind === "offline" ? "Temporarily Offline" : "Coming Soon"}`
      };
    }
    return {
      title: "Cookie Policy | Myrivo"
    };
  }

  return {
    title: `Cookie Policy | ${data.store.name}`,
    alternates: {
      canonical: await buildStorefrontCanonicalUrl("/cookies", data.store.slug)
    }
  };
}

export default async function CookiesPage({ searchParams }: CookiesPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const currentPath = requestHeaders.get("x-pathname") ?? requestHeaders.get("next-url") ?? "";
  const disableStoreCanonicalRedirect = /^\/s\//.test(currentPath);
  const explicitStoreSlug = typeof resolvedSearchParams.store === "string" ? resolvedSearchParams.store.trim() : null;
  if (explicitStoreSlug && !disableStoreCanonicalRedirect) {
    redirect(`${buildStorefrontCookiesPath(explicitStoreSlug)}${buildSearchSuffix(resolvedSearchParams, ["store"])}`);
  }
  const requestedStoreSlug = await resolveRequestedStoreSlug(resolvedSearchParams);

  if (!requestedStoreSlug) {
    return (
      <PageShell maxWidthClassName="max-w-5xl">
        <CookiePolicyContent />
      </PageShell>
    );
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
    surface: "policies"
  });

  return (
    <StorefrontRuntimeProvider runtime={runtime}>
      <StorefrontCookiePolicyPage runtime={runtime} />
    </StorefrontRuntimeProvider>
  );
}
