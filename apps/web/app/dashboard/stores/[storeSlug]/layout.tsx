import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { StoreWorkspaceOnboardingBanner } from "@/components/onboarding/store-workspace-onboarding-banner";
import { isDashboardOnboardingPath } from "@/lib/routes/store-workspace";
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
  const requestHeaders = await headers();
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
  const currentPathCandidate =
    requestHeaders.get("x-pathname") ??
    requestHeaders.get("next-url") ??
    requestHeaders.get("x-invoke-path") ??
    requestHeaders.get("x-matched-path");
  const hideOnboardingBanner = isDashboardOnboardingPath(currentPathCandidate);

  return (
    <>
      {!hideOnboardingBanner && onboardingProgress ? <StoreWorkspaceOnboardingBanner progress={onboardingProgress} /> : null}
      {children}
    </>
  );
}
