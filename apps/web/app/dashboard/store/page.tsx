import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DashboardStoreSettingsPage() {
  redirect("/dashboard/store-settings/profile");
}
