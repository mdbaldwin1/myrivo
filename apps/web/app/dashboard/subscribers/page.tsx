import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DashboardSubscribersPage() {
  redirect("/dashboard/marketing/subscribers");
}
