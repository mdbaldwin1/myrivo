import { LoginForm } from "@/components/auth/login-form";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { resolveAuthenticatedWorkspacePath } from "@/lib/auth/authenticated-workspace";
import { sanitizeReturnTo } from "@/lib/auth/return-to";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedReturnTo = typeof resolvedSearchParams.returnTo === "string" ? resolvedSearchParams.returnTo : null;
  const returnTo = sanitizeReturnTo(requestedReturnTo, "/dashboard");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    const fallbackPath = await resolveAuthenticatedWorkspacePath(user.id);
    redirect(sanitizeReturnTo(requestedReturnTo, fallbackPath));
  }

  return (
    <PageShell maxWidthClassName="max-w-lg">
      <LoginForm returnTo={returnTo} />
    </PageShell>
  );
}
