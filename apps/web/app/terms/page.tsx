import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { LegalMarkdown } from "@/components/legal/legal-markdown";
import { StorefrontLegalPage } from "@/components/storefront/storefront-legal-page";
import { StorefrontRuntimeProvider } from "@/components/storefront/storefront-runtime-provider";
import { getPublishedStoreLegalDocumentSnapshot, resolveStoreLegalDocument } from "@/lib/legal/store-documents";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublishedLegalDocumentByKey } from "@/lib/legal/documents";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { buildStorefrontCanonicalUrl, resolveStorefrontCanonicalRedirect } from "@/lib/storefront/seo";
import { createStorefrontRuntime } from "@/lib/storefront/runtime";
import { resolveStoreSlugFromDomain } from "@/lib/stores/domain-store";
import { PageShell } from "@/components/layout/page-shell";

export const dynamic = "force-dynamic";

type TermsPageProps = {
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

export async function generateMetadata({ searchParams }: TermsPageProps): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const requestedStoreSlug = await resolveRequestedStoreSlug(resolvedSearchParams);
  if (!requestedStoreSlug) {
    return {
      title: "Terms and Conditions | Myrivo"
    };
  }

  const data = await loadStorefrontData(requestedStoreSlug);
  if (!data) {
    return {
      title: "Terms and Conditions | Myrivo"
    };
  }

  const admin = createSupabaseAdminClient();
  const { getStoreLegalDocumentByStoreId } = await import("@/lib/legal/store-documents");
  const record = await getStoreLegalDocumentByStoreId(admin, data.store.id, "terms");
  const document = resolveStoreLegalDocument("terms", data.store, data.settings, getPublishedStoreLegalDocumentSnapshot(record));

  return {
    title: `${document.title} | ${data.store.name}`,
    alternates: {
      canonical: await buildStorefrontCanonicalUrl("/terms", data.store.slug)
    }
  };
}

export default async function TermsPage({ searchParams }: TermsPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedStoreSlug = await resolveRequestedStoreSlug(resolvedSearchParams);
  if (requestedStoreSlug) {
    const redirectUrl = await resolveStorefrontCanonicalRedirect("/terms", requestedStoreSlug);
    if (redirectUrl) {
      redirect(redirectUrl);
    }

    const data = await loadStorefrontData(requestedStoreSlug);
    if (!data) {
      notFound();
    }

    const admin = createSupabaseAdminClient();
    const { getStoreLegalDocumentByStoreId } = await import("@/lib/legal/store-documents");
    const record = await getStoreLegalDocumentByStoreId(admin, data.store.id, "terms");
    const document = resolveStoreLegalDocument("terms", data.store, data.settings, getPublishedStoreLegalDocumentSnapshot(record));
    const runtime = createStorefrontRuntime({
      ...data,
      mode: "live",
      surface: "terms"
    });

    return (
      <StorefrontRuntimeProvider runtime={runtime}>
        <StorefrontLegalPage
          documentKey="terms"
          document={document}
          store={data.store}
          viewer={data.viewer}
          branding={data.branding}
          settings={data.settings}
        />
      </StorefrontRuntimeProvider>
    );
  }

  const supabase = await createSupabaseServerClient();
  const terms = await getPublishedLegalDocumentByKey(supabase, "terms");

  return (
    <PageShell maxWidthClassName="max-w-3xl">
      <article className="space-y-4">
        <header>
          <h1 className="text-3xl font-semibold">Terms and Conditions</h1>
          {terms?.version_label ? (
            <p className="text-sm text-muted-foreground">
              Version {terms.version_label}
              {terms.published_at ? ` • Published ${new Date(terms.published_at).toLocaleDateString("en-US")}` : ""}
            </p>
          ) : null}
        </header>
        <LegalMarkdown content={terms?.content_markdown?.trim() || "Terms and Conditions are being configured. Please check back soon."} />
      </article>
    </PageShell>
  );
}
