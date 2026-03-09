import { redirectToActiveStoreWorkspace } from "@/app/dashboard/_lib/legacy-store-route-redirect";

type PageProps = {
  params: Promise<{ orderId: string }>;
};

export default async function LegacyPackingSlipPage({ params }: PageProps) {
  const { orderId } = await params;
  await redirectToActiveStoreWorkspace(`/orders/${orderId}/packing-slip`);
}
