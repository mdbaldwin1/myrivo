import { redirect } from "next/navigation";
import { getOnboardingSessionBundleForUser } from "@/lib/onboarding/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type OnboardingWorkflowPageProps = {
  params: Promise<{ storeId: string }>;
};

export default async function OnboardingWorkflowPage({ params }: OnboardingWorkflowPageProps) {
  const { storeId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const bundle = await getOnboardingSessionBundleForUser(user.id, storeId);
  if (!bundle) {
    redirect("/dashboard/stores/onboarding/new");
  }

  if (bundle.session.status === "generation_pending" || bundle.session.status === "generation_running") {
    redirect(`/dashboard/stores/${bundle.store.slug}/onboarding/generating`);
  }

  if (bundle.session.status === "reveal_ready" || bundle.session.status === "completed") {
    redirect(`/dashboard/stores/${bundle.store.slug}/onboarding/reveal`);
  }

  redirect(`/dashboard/stores/${bundle.store.slug}/onboarding`);
}
