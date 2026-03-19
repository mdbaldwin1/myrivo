import { redirectToActiveStoreWorkspace } from "@/app/dashboard/_lib/legacy-store-route-redirect";

export const dynamic = "force-dynamic";

export default async function DashboardStoreSettingsPrivacyRedirectPage() {
  await redirectToActiveStoreWorkspace("/store-settings/privacy");
}
