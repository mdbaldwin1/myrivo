import { AccountSettingsForm } from "@/components/dashboard/account-settings-form";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardAccountSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name,avatar_path,global_role,metadata")
    .eq("id", user.id)
    .maybeSingle<{ display_name: string | null; avatar_path: string | null; global_role: "user" | "admin" | "support"; metadata: Record<string, unknown> }>();

  const accountPreferences = (() => {
    const raw = profile?.metadata?.account_preferences;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return {
        weeklyDigestEmails: true,
        productAnnouncements: true
      };
    }
    const values = raw as Record<string, unknown>;
    return {
      weeklyDigestEmails: values.weeklyDigestEmails !== false,
      productAnnouncements: values.productAnnouncements !== false
    };
  })();

  return (
    <section className="space-y-4">
      <DashboardPageHeader title="Profile & Account" description="Your account identity, preferences, and customer dashboard access." />
      <AccountSettingsForm
        email={user.email ?? null}
        globalRole={profile?.global_role ?? "user"}
        initialDisplayName={profile?.display_name ?? ""}
        initialAvatarPath={profile?.avatar_path ?? null}
        initialPreferences={accountPreferences}
      />
    </section>
  );
}
