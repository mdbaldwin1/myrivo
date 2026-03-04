import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacyDashboardStorePoliciesPage() {
  redirect("/dashboard/content-studio/policies");
}
