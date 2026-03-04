import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacyDashboardStoreCheckoutPage() {
  redirect("/dashboard/store-settings/checkout-rules");
}
