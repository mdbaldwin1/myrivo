import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { SignupForm } from "@/components/auth/signup-form";
import { redirect } from "next/navigation";
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
  const returnTo = sanitizeReturnTo(requestedReturnTo, "/dashboard/welcome");
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
    <AuthSplitLayout
      eyebrow="Start selling"
      title="Create your Myrivo account and launch from one connected platform."
      description="Set up your account first, then move into storefront design, catalog setup, checkout, and fulfillment from the same workspace."
      highlights={["Branded storefront", "Checkout and pickup", "Product workflow", "Order operations"]}
    >
      <SignupForm
        returnTo={returnTo}
        prefillEmail={getSingleParam(resolvedSearchParams, "email")}
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
    </AuthSplitLayout>
  );
}
