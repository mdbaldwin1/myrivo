import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DashboardContentStudioPage() {
  redirect("/dashboard/content-studio/home");
}

