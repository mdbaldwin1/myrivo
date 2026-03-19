import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { OnboardingGeneratingScreen } from "@/components/onboarding/onboarding-generating-screen";
import { getOnboardingSessionBundleForUserBySlug } from "@/lib/onboarding/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DashboardOnboardingGeneratingPageProps = {
  params: Promise<{ storeSlug: string }>;
};

export default async function DashboardOnboardingGeneratingPage({ params }: DashboardOnboardingGeneratingPageProps) {
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

  if (bundle.session.status === "reveal_ready" || bundle.session.status === "completed") {
    redirect(`/dashboard/stores/${bundle.store.slug}/onboarding/reveal`);
  }

  return (
    <PageShell maxWidthClassName="max-w-3xl">
      <OnboardingGeneratingScreen storeId={bundle.store.id} storeSlug={bundle.store.slug} sessionId={bundle.session.id} storeName={bundle.store.name} />
    </PageShell>
  );
}
