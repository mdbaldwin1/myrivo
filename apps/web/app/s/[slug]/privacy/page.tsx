import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { generateMetadata as generatePrivacyMetadata } from "@/app/privacy/page";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return generatePrivacyMetadata({ searchParams: Promise.resolve({ store: slug }) });
}

export default async function StorefrontSlugPrivacyPage({ params }: PageProps) {
  const { slug } = await params;
  const [
    { StorefrontUnavailablePage },
    { StorefrontLegalPage },
    { StorefrontRuntimeProvider },
    { createSupabaseAdminClient },
    { getPublishedStoreLegalDocumentSnapshot, getStoreLegalDocumentByStoreId, resolveStoreLegalDocument },
    { loadStorefrontData },
    { createStorefrontRuntime },
    { loadStorefrontUnavailableData }
  ] = await Promise.all([
    import("@/components/storefront/storefront-unavailable-page"),
    import("@/components/storefront/storefront-legal-page"),
    import("@/components/storefront/storefront-runtime-provider"),
    import("@/lib/supabase/admin"),
    import("@/lib/legal/store-documents"),
    import("@/lib/storefront/load-storefront-data"),
    import("@/lib/storefront/runtime"),
    import("@/lib/storefront/unavailable")
  ]);
  const data = await loadStorefrontData(slug);

  if (!data) {
    const unavailable = await loadStorefrontUnavailableData(slug);
    if (unavailable) {
      return <StorefrontUnavailablePage state={unavailable} />;
    }
    notFound();
  }

  const admin = createSupabaseAdminClient();
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
