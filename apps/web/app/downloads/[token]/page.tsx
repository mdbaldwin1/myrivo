import { DigitalDownloadList } from "@/components/customer/digital-download-list";

export const dynamic = "force-dynamic";

export default async function DigitalDownloadsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <DigitalDownloadList token={token} />;
}
