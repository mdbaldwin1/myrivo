import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { DomainManager } from "@/components/dashboard/domain-manager";
import { PlatformControlsSettings } from "@/components/dashboard/platform-controls-settings";
import { StorePaymentsSettings } from "@/components/dashboard/store-payments-settings";
import { StoreShippingSettings } from "@/components/dashboard/store-shipping-settings";

export const dynamic = "force-dynamic";

export default function DashboardStoreSettingsIntegrationsPage() {
  return (
    <section className="space-y-4">
      <DashboardPageHeader
        title="Integrations"
        description="Payment and shipping-provider configuration for storefront operations."
      />
      <PlatformControlsSettings />
      <DomainManager />
      <StorePaymentsSettings />
      <StoreShippingSettings />
    </section>
  );
}
