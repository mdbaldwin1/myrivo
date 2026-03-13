import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { StorefrontPrivacyRequestPage } from "@/components/storefront/storefront-privacy-request-page";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { resolveStoreSlugFromDomain } from "@/lib/stores/domain-store";

export const dynamic = "force-dynamic";

type PrivacyRequestPageProps = {
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

export async function generateMetadata({ searchParams }: PrivacyRequestPageProps): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const requestedStoreSlug = await resolveRequestedStoreSlug(resolvedSearchParams);

  if (!requestedStoreSlug) {
    return {
      title: "Privacy request | Myrivo"
    };
  }

  const data = await loadStorefrontData(requestedStoreSlug);
  if (!data) {
    return {
      title: "Privacy request | Myrivo"
    };
  }

  return {
    title: `Privacy request | ${data.store.name}`
  };
}

export default async function PrivacyRequestPage({ searchParams }: PrivacyRequestPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedStoreSlug = await resolveRequestedStoreSlug(resolvedSearchParams);

  if (!requestedStoreSlug) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    return (
      <PageShell maxWidthClassName="max-w-2xl">
        <article className="space-y-4">
          <h1 className="text-3xl font-semibold">Privacy request</h1>
          <p className="text-sm text-muted-foreground">
            Open this page from a specific storefront to submit a store-level privacy request.
          </p>
          {user ? null : (
            <p className="text-sm text-muted-foreground">
              If you were trying to reach a specific store, return to that storefront and use its privacy links.
            </p>
          )}
        </article>
      </PageShell>
    );
  }

  const data = await loadStorefrontData(requestedStoreSlug);
  if (!data) {
    notFound();
  }

  return (
    <StorefrontPrivacyRequestPage
      store={data.store}
      viewer={data.viewer}
      branding={data.branding}
      settings={data.settings}
      privacyProfile={data.privacyProfile}
    />
  );
}
