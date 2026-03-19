import { CustomerAccountDashboardPanels } from "@/components/customer/customer-account-dashboard-panels";
import { PendingStoreInvitesCard } from "@/components/dashboard/pending-store-invites-card";
import type { DashboardHomeData } from "@/lib/dashboard/home/dashboard-home-types";

type DashboardHomeShellProps = {
  data: DashboardHomeData;
  storefrontLinksBySlug: Record<
    string,
    {
      storefrontHref: string;
      cartHref: string;
    }
  >;
  legacyPanelProps: {
    initialSavedStores: Array<{
      id: string;
      stores: { id: string; name: string; slug: string; status?: string } | { id: string; name: string; slug: string; status?: string }[] | null;
    }>;
    initialSavedItems: Array<{
      id: string;
      products: { id: string; title: string } | { id: string; title: string }[] | null;
      product_variants: { id: string; title: string | null } | { id: string; title: string | null }[] | null;
      stores: { id: string; name: string; slug: string; status?: string } | { id: string; name: string; slug: string; status?: string }[] | null;
    }>;
    carts: Array<{
      id: string;
      updated_at: string | null;
      stores: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
    }>;
    orders: Array<{
      id: string;
      total_cents: number;
      status: string;
      created_at: string;
      stores: { name: string; slug: string } | { name: string; slug: string }[] | null;
    }>;
  };
};

export function DashboardHomeShell({ data, storefrontLinksBySlug, legacyPanelProps }: DashboardHomeShellProps) {
  return (
    <section className="space-y-4">
      {data.pendingInvites.length > 0 ? <PendingStoreInvitesCard invites={data.pendingInvites} /> : null}

      <CustomerAccountDashboardPanels
        initialSavedStores={legacyPanelProps.initialSavedStores}
        initialSavedItems={legacyPanelProps.initialSavedItems}
        carts={legacyPanelProps.carts}
        orders={legacyPanelProps.orders}
        storefrontLinksBySlug={storefrontLinksBySlug}
      />
    </section>
  );
}
