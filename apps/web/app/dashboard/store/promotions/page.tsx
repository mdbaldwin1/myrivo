import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacyDashboardStorePromotionsPage() {
  redirect("/dashboard/marketing/promotions");
}
