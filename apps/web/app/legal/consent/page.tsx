import Link from "next/link";
import { redirect } from "next/navigation";
import { LegalConsentForm } from "@/components/auth/legal-consent-form";
import { PageShell } from "@/components/layout/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { sanitizeReturnTo } from "@/lib/auth/return-to";
import { getMissingRequiredLegalVersions } from "@/lib/legal/consent";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LegalConsentPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function LegalConsentPage({ searchParams }: LegalConsentPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedReturnTo = typeof resolvedSearchParams.returnTo === "string" ? resolvedSearchParams.returnTo : null;
  const returnTo = sanitizeReturnTo(requestedReturnTo, "/dashboard");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?returnTo=${encodeURIComponent(`/legal/consent?returnTo=${encodeURIComponent(returnTo)}`)}`);
  }

  const missingVersions = await getMissingRequiredLegalVersions(supabase, user.id);
  if (missingVersions.length === 0) {
    redirect(returnTo);
  }

  return (
    <PageShell maxWidthClassName="max-w-2xl">
      <SectionCard
        title="Legal update required"
        description="We updated required legal documents. Please review and accept to continue using your workspace."
      >
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
      </SectionCard>
    </PageShell>
  );
}
