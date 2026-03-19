import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { generateMetadata as generateTermsMetadata } from "@/app/terms/page";
import { StorefrontUnavailablePage } from "@/components/storefront/storefront-unavailable-page";
import { StorefrontLegalPage } from "@/components/storefront/storefront-legal-page";
import { StorefrontRuntimeProvider } from "@/components/storefront/storefront-runtime-provider";
import { getPublishedStoreLegalDocumentSnapshot, resolveStoreLegalDocument } from "@/lib/legal/store-documents";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { createStorefrontRuntime } from "@/lib/storefront/runtime";
import { loadStorefrontUnavailableData } from "@/lib/storefront/unavailable";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return generateTermsMetadata({ searchParams: Promise.resolve({ store: slug }) });
}

export default async function StorefrontSlugTermsPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await loadStorefrontData(slug);

  if (!data) {
    const unavailable = await loadStorefrontUnavailableData(slug);
    if (unavailable) {
      return <StorefrontUnavailablePage state={unavailable} />;
    }
    notFound();
  }

  const admin = createSupabaseAdminClient();
  const { getStoreLegalDocumentByStoreId } = await import("@/lib/legal/store-documents");
  const record = await getStoreLegalDocumentByStoreId(admin, data.store.id, "terms");
  const publishedSnapshot = getPublishedStoreLegalDocumentSnapshot(record);
  const document = resolveStoreLegalDocument("terms", data.store, data.settings, {
    baseDocumentTitle: publishedSnapshot?.published_title ?? "Terms & Conditions",
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
        privacyProfile={data.privacyProfile}
      />
    </StorefrontRuntimeProvider>
  );
}
