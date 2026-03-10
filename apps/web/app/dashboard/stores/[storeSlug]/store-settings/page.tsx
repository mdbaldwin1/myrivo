import Link from "next/link";
import { Settings } from "lucide-react";
import { DashboardPageScaffold } from "@/components/dashboard/dashboard-page-scaffold";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildStoreSettingsWorkspaceStatuses, storeSettingsWorkspaceGroups } from "@/lib/store-editor/store-settings-workspace";
import { getStoreShippingConfig } from "@/lib/shipping/store-config";
import { getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ storeSlug: string }> };

export default async function StoreWorkspaceStoreSettingsIndexPage({ params }: PageProps) {
  const { storeSlug } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const bundle = await getOwnedStoreBundleForSlug(user.id, storeSlug);
  if (!bundle) {
    return null;
  }

  const [domainResult, memberResult, pickupSettingsResult, pickupLocationsResult, shippingConfig] = await Promise.all([
    supabase
      .from("store_domains")
      .select("id", { count: "exact", head: true })
      .eq("store_id", bundle.store.id)
      .eq("verification_status", "verified")
      .eq("is_primary", true),
    supabase.from("store_memberships").select("id", { count: "exact", head: true }).eq("store_id", bundle.store.id).eq("status", "active"),
    supabase.from("store_pickup_settings").select("enabled").eq("store_id", bundle.store.id).maybeSingle(),
    supabase.from("pickup_locations").select("id", { count: "exact", head: true }).eq("store_id", bundle.store.id).eq("is_active", true),
    getStoreShippingConfig(supabase, bundle.store.id, true)
  ]);

  const statuses = buildStoreSettingsWorkspaceStatuses({
    storeStatus: bundle.store.status,
    hasLogo: Boolean(bundle.branding?.logo_path),
    hasVerifiedPrimaryDomain: Boolean(domainResult.count && domainResult.count > 0),
    paymentsConnected: Boolean(bundle.store.stripe_account_id),
    shippingEnabled: bundle.settings?.checkout_enable_flat_rate_shipping ?? true,
    pickupEnabled: pickupSettingsResult.data?.enabled ?? false,
    pickupLocationCount: pickupLocationsResult.count ?? 0,
    orderNoteEnabled: bundle.settings?.checkout_allow_order_note ?? false,
    activeMemberCount: memberResult.count ?? 1
  });

  return (
    <DashboardPageScaffold
      title="Store Settings"
      description="Start from grouped operational areas instead of a flat subsection list. This overview highlights what is configured and what still needs attention."
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5" />
            Workspace status
          </CardTitle>
          <CardDescription>
            Store status: <span className="font-medium text-foreground">{statuses.overview}</span> · Payments:{" "}
            <span className="font-medium text-foreground">{statuses.integrations}</span> · Shipping provider:{" "}
            <span className="font-medium text-foreground">{shippingConfig.provider}</span>
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        {storeSettingsWorkspaceGroups.map((group) => (
          <Card key={group.id} className="border-border/70">
            <CardHeader>
              <CardTitle className="text-lg">{group.title}</CardTitle>
              <CardDescription>{group.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.sections.map((section) => (
                  <Card key={section.id} className="border-border/70 shadow-none">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <section.icon className="h-4 w-4 text-muted-foreground" />
                            {section.label}
                          </CardTitle>
                          <CardDescription>{section.description}</CardDescription>
                        </div>
                        <span className="rounded-full border border-border/70 bg-muted/35 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                          {statuses[section.id]}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Link
                        href={`/dashboard/stores/${storeSlug}${section.href}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full justify-center")}
                      >
                        Open {section.label}
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardPageScaffold>
  );
}
