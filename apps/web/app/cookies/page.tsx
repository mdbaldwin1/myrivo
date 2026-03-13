import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CookiePolicyContent } from "@/components/privacy/cookie-policy-content";
import { PageShell } from "@/components/layout/page-shell";
import { StorefrontCookiePolicyPage } from "@/components/storefront/storefront-cookie-policy-page";
import { StorefrontRuntimeProvider } from "@/components/storefront/storefront-runtime-provider";
import { buildStorefrontCanonicalUrl } from "@/lib/storefront/seo";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { createStorefrontRuntime } from "@/lib/storefront/runtime";
import { resolveStoreSlugFromDomain } from "@/lib/stores/domain-store";

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
  return resolveStoreSlugFromDomain(host);
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
