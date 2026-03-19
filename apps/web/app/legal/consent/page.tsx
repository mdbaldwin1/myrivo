import Link from "next/link";
import { redirect } from "next/navigation";
import { LegalConsentForm } from "@/components/auth/legal-consent-form";
import { LegalMarkdown } from "@/components/legal/legal-markdown";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { sanitizeReturnTo } from "@/lib/auth/return-to";
import { getMissingRequiredLegalVersions } from "@/lib/legal/consent";
import { getLegalDocumentVersionById } from "@/lib/legal/documents";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LegalConsentPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function LegalConsentPage({ searchParams }: LegalConsentPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedReturnTo = typeof resolvedSearchParams.returnTo === "string" ? resolvedSearchParams.returnTo : null;
  const requestedVersionId = typeof resolvedSearchParams.versionId === "string" ? resolvedSearchParams.versionId : null;
  const returnTo = sanitizeReturnTo(requestedReturnTo, "/dashboard");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?returnTo=${encodeURIComponent(`/legal/consent?returnTo=${encodeURIComponent(returnTo)}`)}`);
  }

  const requestedVersion = requestedVersionId ? await getLegalDocumentVersionById(createSupabaseAdminClient(), requestedVersionId) : null;
  const missingVersions = await getMissingRequiredLegalVersions(supabase, user.id);
  const highlightedVersion = requestedVersionId ? missingVersions.find((version) => version.versionId === requestedVersionId) ?? null : null;
  if (missingVersions.length === 0 && !requestedVersion) {
    redirect(returnTo);
  }

  return (
    <PageShell maxWidthClassName="max-w-2xl">
      <div className="space-y-6">
        <SectionCard
          title="Legal update required"
          description="We updated required legal documents. Please review and accept to continue using your workspace."
        >
          {highlightedVersion ? (
            <p className="mb-4 text-sm text-muted-foreground">
              You opened a notification for <span className="font-medium text-foreground">{highlightedVersion.documentTitle}</span>{" "}
              version {highlightedVersion.versionLabel}. Accepting below will record all currently required legal updates for your account.
            </p>
          ) : requestedVersion ? (
            <p className="mb-4 text-sm text-muted-foreground">
              You opened a notification for <span className="font-medium text-foreground">{requestedVersion.legal_documents?.title ?? "Legal update"}</span>{" "}
              version {requestedVersion.version_label}. You have already accepted the currently required legal updates for your account, but you can review the published version below.
            </p>
          ) : null}
          <ul className="space-y-2 text-sm text-muted-foreground">
            {missingVersions.map((version) => (
              <li key={version.versionId} className="rounded-md border border-border/70 p-3">
                <p className="font-medium text-foreground">{version.documentTitle}</p>
                <p className="text-xs text-muted-foreground">Version {version.versionLabel}</p>
                <Link
                  href={version.documentKey === "privacy" ? "/privacy" : "/terms"}
                  className="mt-1 inline-block text-xs font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Review document
                </Link>
              </li>
            ))}
          </ul>
          {missingVersions.length > 0 ? (
            <div className="mt-4">
              <LegalConsentForm
                returnTo={returnTo}
                versions={missingVersions.map((version) => ({
                  id: version.versionId,
                  title: version.documentTitle,
                  key: version.documentKey,
                  versionLabel: version.versionLabel
                }))}
              />
            </div>
          ) : null}
          {missingVersions.length === 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button asChild type="button">
                <Link href={returnTo}>Continue</Link>
              </Button>
            </div>
          ) : null}
        </SectionCard>
        {requestedVersion ? (
          <SectionCard
            title={`${requestedVersion.legal_documents?.title ?? "Legal document"} ${requestedVersion.version_label}`}
            description={
              requestedVersion.published_at
                ? `Published ${new Date(requestedVersion.published_at).toLocaleDateString("en-US")}`
                : "Published legal version"
            }
          >
            <LegalMarkdown content={requestedVersion.content_markdown.trim() || "This legal document has no published content."} />
          </SectionCard>
        ) : null}
      </div>
    </PageShell>
  );
}
