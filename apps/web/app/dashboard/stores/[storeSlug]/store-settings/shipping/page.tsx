import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ storeSlug: string }> };

export const dynamic = "force-dynamic";

export default async function StoreWorkspaceShippingSettingsPage({ params }: PageProps) {
  const { storeSlug } = await params;
  redirect(`/dashboard/stores/${storeSlug}/store-settings/fulfillment`);
}
