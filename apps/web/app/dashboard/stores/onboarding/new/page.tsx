import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { OnboardingNewStoreForm } from "@/components/onboarding/onboarding-new-store-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardNewOnboardingStorePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <PageShell maxWidthClassName="max-w-3xl">
      <OnboardingNewStoreForm />
    </PageShell>
  );
}
