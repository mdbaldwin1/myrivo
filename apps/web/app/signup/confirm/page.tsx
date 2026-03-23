import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { redirect } from "next/navigation";
import { SignupConfirmationCard } from "@/components/auth/signup-confirmation-card";
import { resolveAuthenticatedWorkspacePath } from "@/lib/auth/authenticated-workspace";
import { sanitizeReturnTo } from "@/lib/auth/return-to";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SignupConfirmationPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : null;
}

export default async function SignupConfirmationPage({ searchParams }: SignupConfirmationPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedReturnTo = getSingleParam(resolvedSearchParams, "returnTo");
  const returnTo = sanitizeReturnTo(requestedReturnTo, "/dashboard/welcome");
  const email = getSingleParam(resolvedSearchParams, "email");

  if (!email) {
    redirect(`/signup?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    const fallbackPath = await resolveAuthenticatedWorkspacePath(user.id);
    redirect(sanitizeReturnTo(requestedReturnTo, fallbackPath));
  }

  return (
    <AuthSplitLayout
      eyebrow="Almost there"
      title="Confirm your email to finish account setup."
      description="Once you open the confirmation link, we’ll send you straight back into Myrivo so you can keep going."
      highlights={["Secure email verification", "Return to onboarding", "Resend if needed", "Same seller workspace after confirm"]}
    >
      <SignupConfirmationCard email={email} returnTo={returnTo} />
    </AuthSplitLayout>
  );
}
