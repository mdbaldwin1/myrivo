import { redirectToActiveStoreWorkspace } from "@/app/dashboard/_lib/legacy-store-route-redirect";

export const dynamic = "force-dynamic";

export default async function DashboardReportsBillingPage() {
  await redirectToActiveStoreWorkspace("/reports/billing");
}
