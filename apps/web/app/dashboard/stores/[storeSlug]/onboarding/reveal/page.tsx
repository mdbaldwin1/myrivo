import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { OnboardingRevealScreen } from "@/components/onboarding/onboarding-reveal-screen";
import { markOnboardingMilestone } from "@/lib/onboarding/analytics";
import { getOnboardingSessionBundleForUserBySlug } from "@/lib/onboarding/session";
import { loadStorefrontData } from "@/lib/storefront/load-storefront-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DashboardOnboardingRevealPageProps = {
  params: Promise<{ storeSlug: string }>;
};

export default async function DashboardOnboardingRevealPage({ params }: DashboardOnboardingRevealPageProps) {
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

  if (bundle.session.status === "in_progress" || bundle.session.status === "generation_failed") {
    redirect(`/dashboard/stores/${bundle.store.slug}/onboarding`);
  }

  if (bundle.session.status === "generation_pending" || bundle.session.status === "generation_running") {
    redirect(`/dashboard/stores/${bundle.store.slug}/onboarding/generating`);
  }

  await markOnboardingMilestone({
    sessionId: bundle.session.id,
    storeId: bundle.store.id,
    milestone: "reveal_viewed"
  });

  const storefrontData = await loadStorefrontData(bundle.store.slug);

  return (
    <PageShell maxWidthClassName="max-w-7xl">
      <OnboardingRevealScreen
        store={bundle.store}
        sessionId={bundle.session.id}
        answers={bundle.answers}
        preview={{
          announcement: storefrontData?.settings?.announcement ?? null,
          fulfillmentMessage: storefrontData?.settings?.fulfillment_message ?? null,
          footerTagline: storefrontData?.settings?.footer_tagline ?? null,
          supportEmail: storefrontData?.settings?.support_email ?? null,
          primaryColor: storefrontData?.branding?.primary_color ?? null,
          accentColor: storefrontData?.branding?.accent_color ?? null,
          productCount: storefrontData?.products.length ?? 0
        }}
      />
    </PageShell>
  );
}
