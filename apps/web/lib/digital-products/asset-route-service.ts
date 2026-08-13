import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { completeAssetUpload } from "./asset-service";
import { processPreview } from "./preview-service";

export async function completeOwnedAssetUpload(input: {
  storeId: string;
  storeName: string;
  intentId: string;
}) {
  const admin = createSupabaseAdminClient();
  const completed = await completeAssetUpload({
    admin,
    storeId: input.storeId,
    intentId: input.intentId,
  });

  let preview: { status: "ready"; publicUrl: string | null } | null = null;
  if (completed.mimeType === "image/jpeg" || completed.mimeType === "image/png") {
    const result = await processPreview({
      admin,
      storeId: input.storeId,
      productId: completed.productId,
      sourceAssetVersionId: completed.versionId,
      storeName: input.storeName,
    });
    preview = { status: result.status, publicUrl: result.publicUrl };
  }

  return { ...completed, preview };
}
