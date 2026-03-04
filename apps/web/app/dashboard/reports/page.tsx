import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DashboardReportsPage() {
  redirect("/dashboard/reports/insights");
}

