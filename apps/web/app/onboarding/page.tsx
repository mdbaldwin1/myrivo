import { redirect } from "next/navigation";
import { StoreBootstrapForm } from "@/components/onboarding/store-bootstrap-form";
import { PageShell } from "@/components/layout/page-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStoreOnboardingProgressForUser } from "@/lib/stores/onboarding";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const existingStores = await getStoreOnboardingProgressForUser(user.id);

  return (
    <PageShell maxWidthClassName="max-w-6xl">
      <StoreBootstrapForm existingStores={existingStores} />
    </PageShell>
  );
}
