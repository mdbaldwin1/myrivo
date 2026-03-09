import { PageShell } from "@/components/layout/page-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublishedLegalDocumentByKey } from "@/lib/legal/documents";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
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
        <div className="rounded-md border border-border/70 bg-card p-4 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {privacy?.content_markdown?.trim() || "Privacy Policy is being configured. Please check back soon."}
        </div>
      </article>
    </PageShell>
  );
}
