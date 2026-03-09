import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ storeSlug: string }> };

export default async function LegacyStoreWorkspaceContentStudioHomePage({ params }: PageProps) {
  const { storeSlug } = await params;
  redirect(`/dashboard/stores/${storeSlug}/content-workspace/home`);
}
