import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacyDashboardStoreOperationsPage() {
  redirect("/dashboard/content-studio/policies");
}
