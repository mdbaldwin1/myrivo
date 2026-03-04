import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DashboardInsightsPage() {
  redirect("/dashboard/reports/insights");
}
