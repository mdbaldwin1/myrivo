import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { StoreWorkspaceOnboardingBanner } from "@/components/onboarding/store-workspace-onboarding-banner";
import { getStoreOnboardingProgressForStore } from "@/lib/stores/onboarding";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type StoreWorkspaceLayoutProps = {
  children: ReactNode;
  params: Promise<{ storeSlug: string }>;
};

export default async function StoreWorkspaceLayout({ children, params }: StoreWorkspaceLayoutProps) {
  const { storeSlug } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const bundle = await getOwnedStoreBundle(user.id, "staff");
  const hasAccess = (bundle?.availableStores ?? []).some((store) => store.slug === storeSlug);

  if (!hasAccess) {
    redirect("/dashboard/stores");
  }

  const onboardingProgress = await getStoreOnboardingProgressForStore(user.id, storeSlug);

  return (
    <>
      {onboardingProgress ? (
        <div className="px-4 pt-4 lg:px-6 lg:pt-5">
          <StoreWorkspaceOnboardingBanner progress={onboardingProgress} />
        </div>
      ) : null}
      {children}
    </>
  );
}
