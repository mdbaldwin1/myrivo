import { PageShell } from "@/components/layout/page-shell";
import { LegalMarkdown } from "@/components/legal/legal-markdown";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublishedLegalDocumentByKey } from "@/lib/legal/documents";

export const dynamic = "force-dynamic";

export default async function TermsPage() {
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
