import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ storeSlug: string }> };

export default async function StoreWorkspaceCheckoutExperienceSettingsPage({ params }: PageProps) {
  const { storeSlug } = await params;
  redirect(`/dashboard/stores/${storeSlug}/storefront-studio?surface=cart`);
}
