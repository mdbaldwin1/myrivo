import { SignupForm } from "@/components/auth/signup-form";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { resolveAuthenticatedWorkspacePath } from "@/lib/auth/authenticated-workspace";
import { sanitizeReturnTo } from "@/lib/auth/return-to";
import { getSignupLegalRequirements } from "@/lib/legal/documents";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SignupPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : null;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedReturnTo = typeof resolvedSearchParams.returnTo === "string" ? resolvedSearchParams.returnTo : null;
  const returnTo = sanitizeReturnTo(requestedReturnTo, "/onboarding");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    const fallbackPath = await resolveAuthenticatedWorkspacePath(user.id);
    redirect(sanitizeReturnTo(requestedReturnTo, fallbackPath));
  }

  const legalRequirements = await getSignupLegalRequirements(supabase);
  const legalUnavailable = !legalRequirements.terms || !legalRequirements.privacy;

  return (
    <PageShell maxWidthClassName="max-w-lg">
      <SignupForm
        returnTo={returnTo}
        marketingAttribution={{
          source: getSingleParam(resolvedSearchParams, "source"),
          marketingPage: getSingleParam(resolvedSearchParams, "marketingPage"),
          marketingSection: getSingleParam(resolvedSearchParams, "marketingSection"),
          marketingCta: getSingleParam(resolvedSearchParams, "marketingCta"),
          marketingLabel: getSingleParam(resolvedSearchParams, "marketingLabel")
        }}
        legalRequirements={
          legalRequirements.terms && legalRequirements.privacy
            ? {
                terms: legalRequirements.terms,
                privacy: legalRequirements.privacy
              }
            : null
        }
        legalUnavailable={legalUnavailable}
      />
    </PageShell>
  );
}
