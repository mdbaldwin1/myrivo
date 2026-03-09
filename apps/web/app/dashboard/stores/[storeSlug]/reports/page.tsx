import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ storeSlug: string }> };

export default async function StoreWorkspaceReportsIndexPage({ params }: PageProps) {
  const { storeSlug } = await params;
  redirect(`/dashboard/stores/${storeSlug}/reports/insights`);
}
