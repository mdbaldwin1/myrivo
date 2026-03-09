import { redirect } from "next/navigation";
import { AccountWorkspaceShell } from "@/components/account/account-workspace-shell";
import { AccountSettingsForm } from "@/components/dashboard/account-settings-form";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { sanitizeReturnTo } from "@/lib/auth/return-to";
import { resolveAccountNotificationPreferences } from "@/lib/notifications/preferences";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const supabase = await createSupabaseServerClient();
  const resolvedSearchParams = await searchParams;
  const requestedReturnTo = typeof resolvedSearchParams.returnTo === "string" ? resolvedSearchParams.returnTo : null;
  const backHref = sanitizeReturnTo(requestedReturnTo, "/dashboard");
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name,avatar_path,global_role,metadata")
    .eq("id", user.id)
    .maybeSingle<{
      display_name: string | null;
      avatar_path: string | null;
      global_role: "user" | "admin" | "support";
      metadata: Record<string, unknown>;
    }>();

  const accountPreferences = resolveAccountNotificationPreferences(profile?.metadata);

  return (
    <AccountWorkspaceShell activeItem="settings" backHref={backHref}>
      <section className="flex min-h-0 flex-1 flex-col">
        <AccountSettingsForm
          email={user.email ?? null}
          globalRole={profile?.global_role ?? "user"}
          initialDisplayName={profile?.display_name ?? ""}
          initialAvatarPath={profile?.avatar_path ?? null}
          initialPreferences={accountPreferences}
          mode="settings"
          contentMaxWidthClassName="max-w-none"
          header={<DashboardPageHeader title="Settings" description="Notification and communication preferences for your account." />}
        />
      </section>
    </AccountWorkspaceShell>
  );
}
