import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { PageShell } from "@/components/layout/page-shell";
import { sanitizeReturnTo } from "@/lib/auth/return-to";

type ForgotPasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedReturnTo = typeof resolvedSearchParams.returnTo === "string" ? resolvedSearchParams.returnTo : null;
  const returnTo = sanitizeReturnTo(requestedReturnTo, "/dashboard");

  return (
    <PageShell maxWidthClassName="max-w-lg">
      <ForgotPasswordForm returnTo={returnTo} />
    </PageShell>
  );
}
