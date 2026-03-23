import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { StorePaymentsSettings } from "@/components/dashboard/store-payments-settings";
import { StoreShippingSettings } from "@/components/dashboard/store-shipping-settings";

export const dynamic = "force-dynamic";

export default function StoreWorkspaceIntegrationsSettingsPage() {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <DashboardPageHeader title="Integrations" description="Payment and shipping-provider configuration for storefront operations." />
        <StorePaymentsSettings />
        <StoreShippingSettings />
      </div>
    </section>
  );
}
