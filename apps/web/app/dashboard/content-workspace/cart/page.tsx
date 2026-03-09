import { redirectToActiveStoreWorkspace } from "@/app/dashboard/_lib/legacy-store-route-redirect";

export const dynamic = "force-dynamic";

export default async function DashboardContentWorkspaceCartPage() {
  await redirectToActiveStoreWorkspace("/content-workspace/cart");
}
