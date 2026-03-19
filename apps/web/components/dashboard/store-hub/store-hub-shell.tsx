import { StoreHubPortfolioPanel } from "@/components/dashboard/store-hub/modules/store-hub-portfolio-panel";
import type { StoreHubData } from "@/lib/dashboard/store-hub/store-hub-types";

type StoreHubShellProps = {
  data: StoreHubData;
  logoByStoreId: Map<string, string | null>;
};

export function StoreHubShell({ data, logoByStoreId }: StoreHubShellProps) {
  return (
    <section className="space-y-4">
      <StoreHubPortfolioPanel stores={data.stores} logoByStoreId={logoByStoreId} />
    </section>
  );
}
