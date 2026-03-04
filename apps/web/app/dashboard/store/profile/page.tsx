import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacyDashboardStoreProfilePage() {
  redirect("/dashboard/store-settings/profile");
}

