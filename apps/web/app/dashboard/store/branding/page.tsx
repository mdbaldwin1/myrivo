import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacyDashboardStoreBrandingPage() {
  redirect("/dashboard/store-settings/branding");
}
