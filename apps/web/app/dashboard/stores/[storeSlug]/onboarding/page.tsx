import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { OnboardingWorkflowShell } from "@/components/onboarding/onboarding-workflow-shell";
import { getOnboardingSessionBundleForUserBySlug } from "@/lib/onboarding/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DashboardOnboardingWorkflowPageProps = {
  params: Promise<{ storeSlug: string }>;
};

export default async function DashboardOnboardingWorkflowPage({ params }: DashboardOnboardingWorkflowPageProps) {
  const { storeSlug } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const bundle = await getOnboardingSessionBundleForUserBySlug(user.id, storeSlug);
  if (!bundle) {
    redirect("/dashboard/stores/onboarding/new");
  }

  if (bundle.session.status === "generation_pending" || bundle.session.status === "generation_running") {
    redirect(`/dashboard/stores/${bundle.store.slug}/onboarding/generating`);
  }

  if (bundle.session.status === "reveal_ready" || bundle.session.status === "completed") {
    redirect(`/dashboard/stores/${bundle.store.slug}/onboarding/reveal`);
  }

  return (
    <PageShell maxWidthClassName="max-w-4xl">
      <OnboardingWorkflowShell store={bundle.store} session={bundle.session} answers={bundle.answers} stepProgress={bundle.stepProgress} />
    </PageShell>
  );
}
