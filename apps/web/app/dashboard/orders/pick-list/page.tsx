import { redirectToActiveStoreWorkspace } from "@/app/dashboard/_lib/legacy-store-route-redirect";

export default async function LegacyDailyPickListPage() {
  await redirectToActiveStoreWorkspace("/orders/pick-list");
}
