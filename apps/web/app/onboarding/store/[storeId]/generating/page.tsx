import { redirect } from "next/navigation";
import { getOnboardingSessionBundleForUser } from "@/lib/onboarding/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type OnboardingGeneratingPageProps = {
  params: Promise<{ storeId: string }>;
};

export default async function OnboardingGeneratingPage({ params }: OnboardingGeneratingPageProps) {
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

  redirect(`/dashboard/stores/${bundle.store.slug}/onboarding/generating`);
}
