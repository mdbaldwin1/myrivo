import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { PageShell } from "@/components/layout/page-shell";
import { sanitizeReturnTo } from "@/lib/auth/return-to";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ResetPasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedReturnTo = typeof resolvedSearchParams.returnTo === "string" ? resolvedSearchParams.returnTo : null;
  const returnTo = sanitizeReturnTo(requestedReturnTo, "/dashboard");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <PageShell maxWidthClassName="max-w-lg">
      <ResetPasswordForm canReset={Boolean(user)} email={user?.email ?? null} returnTo={returnTo} />
    </PageShell>
  );
}
