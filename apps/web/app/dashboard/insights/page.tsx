import { redirectToActiveStoreWorkspace } from "@/app/dashboard/_lib/legacy-store-route-redirect";

export const dynamic = "force-dynamic";

export default async function DashboardInsightsPage() {
  await redirectToActiveStoreWorkspace("/reports/insights");
}
