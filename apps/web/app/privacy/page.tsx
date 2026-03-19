import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { LegalMarkdown } from "@/components/legal/legal-markdown";
import { StorefrontUnavailablePage } from "@/components/storefront/storefront-unavailable-page";
import { StorefrontLegalPage } from "@/components/storefront/storefront-legal-page";
import { StorefrontRuntimeProvider } from "@/components/storefront/storefront-runtime-provider";
import { getPublishedStoreLegalDocumentSnapshot, resolveStoreLegalDocument } from "@/lib/legal/store-documents";
import { buildSearchSuffix } from "@/lib/storefront/legacy-query";
import { buildStorefrontPrivacyPath } from "@/lib/storefront/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublishedLegalDocumentByKey } from "@/lib/legal/documents";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { buildStorefrontCanonicalUrl, resolveStorefrontCanonicalRedirect } from "@/lib/storefront/seo";
import { createStorefrontRuntime } from "@/lib/storefront/runtime";
import { resolveStoreSlugFromDomain } from "@/lib/stores/domain-store";
import { loadStorefrontUnavailableData } from "@/lib/storefront/unavailable";
import { PageShell } from "@/components/layout/page-shell";

export const dynamic = "force-dynamic";

type PrivacyPageProps = {
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

export async function generateMetadata({ searchParams }: PrivacyPageProps): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const requestedStoreSlug = await resolveRequestedStoreSlug(resolvedSearchParams);
  if (!requestedStoreSlug) {
    return {
      title: "Privacy Policy | Myrivo"
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
      title: "Privacy Policy | Myrivo"
    };
  }

  const admin = createSupabaseAdminClient();
  const { getStoreLegalDocumentByStoreId } = await import("@/lib/legal/store-documents");
  const record = await getStoreLegalDocumentByStoreId(admin, data.store.id, "privacy");
  const publishedSnapshot = getPublishedStoreLegalDocumentSnapshot(record);
  const document = resolveStoreLegalDocument("privacy", data.store, data.settings, {
    baseDocumentTitle: publishedSnapshot?.published_title ?? "Privacy Policy",
    baseBodyMarkdown: publishedSnapshot?.published_body_markdown ?? "",
    baseVersionLabel: publishedSnapshot?.published_base_version_label ?? null,
    variables_json: publishedSnapshot?.variables_json ?? {},
    addendum_markdown: publishedSnapshot?.addendum_markdown ?? "",
    publishedVersion: publishedSnapshot?.published_version ?? null,
    publishedAt: publishedSnapshot?.published_at ?? null,
    effectiveAt: publishedSnapshot?.effective_at ?? null,
    changeSummary: publishedSnapshot?.published_change_summary ?? null
  });

  return {
    title: `${document.title} | ${data.store.name}`,
    alternates: {
      canonical: await buildStorefrontCanonicalUrl("/privacy", data.store.slug)
    }
  };
}

export default async function PrivacyPage({ searchParams }: PrivacyPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const currentPath = requestHeaders.get("x-pathname") ?? requestHeaders.get("next-url") ?? "";
  const disableStoreCanonicalRedirect = /^\/s\//.test(currentPath);
  const explicitStoreSlug = typeof resolvedSearchParams.store === "string" ? resolvedSearchParams.store.trim() : null;
  if (explicitStoreSlug && !disableStoreCanonicalRedirect) {
    redirect(`${buildStorefrontPrivacyPath(explicitStoreSlug)}${buildSearchSuffix(resolvedSearchParams, ["store"])}`);
  }
  const requestedStoreSlug = await resolveRequestedStoreSlug(resolvedSearchParams);
  if (requestedStoreSlug) {
    const redirectUrl = await resolveStorefrontCanonicalRedirect("/privacy", requestedStoreSlug);
    if (redirectUrl) {
      redirect(redirectUrl);
    }

    const data = await loadStorefrontData(requestedStoreSlug);
    if (!data) {
      const unavailable = await loadStorefrontUnavailableData(requestedStoreSlug);
      if (unavailable) {
        return <StorefrontUnavailablePage state={unavailable} />;
      }
      notFound();
    }

    const admin = createSupabaseAdminClient();
    const { getStoreLegalDocumentByStoreId } = await import("@/lib/legal/store-documents");
    const record = await getStoreLegalDocumentByStoreId(admin, data.store.id, "privacy");
    const publishedSnapshot = getPublishedStoreLegalDocumentSnapshot(record);
    const document = resolveStoreLegalDocument("privacy", data.store, data.settings, {
      baseDocumentTitle: publishedSnapshot?.published_title ?? "Privacy Policy",
      baseBodyMarkdown: publishedSnapshot?.published_body_markdown ?? "",
      baseVersionLabel: publishedSnapshot?.published_base_version_label ?? null,
      variables_json: publishedSnapshot?.variables_json ?? {},
      addendum_markdown: publishedSnapshot?.addendum_markdown ?? "",
      publishedVersion: publishedSnapshot?.published_version ?? null,
      publishedAt: publishedSnapshot?.published_at ?? null,
      effectiveAt: publishedSnapshot?.effective_at ?? null,
      changeSummary: publishedSnapshot?.published_change_summary ?? null
    });
    const runtime = createStorefrontRuntime({
      ...data,
      mode: "live",
      surface: "privacy"
    });

    return (
      <StorefrontRuntimeProvider runtime={runtime}>
        <StorefrontLegalPage
          documentKey="privacy"
          document={document}
          store={data.store}
          viewer={data.viewer}
          branding={data.branding}
          settings={data.settings}
          privacyProfile={data.privacyProfile}
        />
      </StorefrontRuntimeProvider>
    );
  }

  const supabase = await createSupabaseServerClient();
  const privacy = await getPublishedLegalDocumentByKey(supabase, "privacy");

  return (
    <PageShell maxWidthClassName="max-w-3xl">
      <article className="space-y-4">
        <header>
          <h1 className="text-3xl font-semibold">Privacy Policy</h1>
          {privacy?.version_label ? (
            <p className="text-sm text-muted-foreground">
              Version {privacy.version_label}
              {privacy.published_at ? ` • Published ${new Date(privacy.published_at).toLocaleDateString("en-US")}` : ""}
            </p>
          ) : null}
        </header>
        <LegalMarkdown content={privacy?.content_markdown?.trim() || "Privacy Policy is being configured. Please check back soon."} />
      </article>
    </PageShell>
  );
}
