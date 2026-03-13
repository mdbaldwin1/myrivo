import { redirect } from "next/navigation";
import { ContextHelpLink } from "@/components/dashboard/context-help-link";
import { DashboardPageScaffold } from "@/components/dashboard/dashboard-page-scaffold";
import { PlatformMarketingCtaTable } from "@/components/dashboard/admin/platform-marketing-cta-table";
import { PlatformMarketingTrendPanel } from "@/components/dashboard/admin/platform-marketing-trend-panel";
import { PlatformMarketingPageTable } from "@/components/dashboard/admin/platform-marketing-page-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasGlobalRole } from "@/lib/auth/roles";
import { getMarketingAnalyticsSummary, type MarketingAnalyticsRange } from "@/lib/marketing/analytics-query";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GlobalUserRole } from "@/types/database";

export const dynamic = "force-dynamic";

type DashboardAdminMarketingPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function resolveRange(value: string | string[] | undefined): MarketingAnalyticsRange {
  return value === "7d" || value === "90d" ? value : "30d";
}

export default async function DashboardAdminMarketingPage({ searchParams }: DashboardAdminMarketingPageProps) {
  const resolvedSearchParams = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("global_role")
    .eq("id", user.id)
    .maybeSingle<{ global_role: GlobalUserRole }>();
  const globalRole = profile?.global_role ?? "user";

  if (!hasGlobalRole(globalRole, "support")) {
    redirect("/dashboard");
  }

  const summary = await getMarketingAnalyticsSummary({
    supabase: createSupabaseAdminClient(),
    range: resolveRange(resolvedSearchParams.range)
  });

  return (
    <DashboardPageScaffold
      title="Marketing Analytics"
      description="Public-site traffic, CTA performance, signup conversion, and experiment reads."
      className="space-y-4 p-3"
      action={<ContextHelpLink href="/docs/marketing-analytics-and-experiments" context="marketing_analytics" label="Marketing Docs" />}
    >
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sessions</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.headline.sessions}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Page views</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.headline.pageViews}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">CTA clicks</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.headline.ctaClicks}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Signup starts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.headline.signupStarts}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Signup completions</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.headline.signupCompletions}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Demo requests</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.headline.demoRequestStarts}</CardContent>
        </Card>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Signup start rate</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{Math.round(summary.headline.signupStartRate * 100)}%</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Signup completion rate</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{Math.round(summary.headline.signupCompletionRate * 100)}%</CardContent>
        </Card>
      </section>

      <PlatformMarketingTrendPanel summary={summary} />
      <PlatformMarketingPageTable summary={summary} />
      <PlatformMarketingCtaTable summary={summary} />
    </DashboardPageScaffold>
  );
}
