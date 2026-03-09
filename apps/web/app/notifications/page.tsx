import { redirect } from "next/navigation";
import { AccountWorkspaceShell } from "@/components/account/account-workspace-shell";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { NotificationsFeed } from "@/components/dashboard/notifications-feed";
import { sanitizeReturnTo } from "@/lib/auth/return-to";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type NotificationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
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

  return (
    <AccountWorkspaceShell activeItem="notifications" backHref={backHref}>
      <section className="space-y-4 p-4 lg:p-4">
        <div className="w-full space-y-4">
          <DashboardPageHeader
            title="Notifications"
            description="Your inbox across all store workspaces. Use actions to jump directly into the right context."
          />
          <div className="rounded-lg border border-border/70 bg-white p-4 shadow-sm">
            <NotificationsFeed storeSlug={null} mode="full" />
          </div>
        </div>
      </section>
    </AccountWorkspaceShell>
  );
}
