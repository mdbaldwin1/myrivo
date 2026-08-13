import { DIGITAL_PREVIEW_BUCKET } from "@/lib/digital-products/assets";
import {
  loadDigitalProductReadiness,
  type ReadinessAdminClient,
} from "@/lib/digital-products/readiness-service";
import type { DigitalProductReadiness, DigitalPreviewStatus } from "@/lib/digital-products/types";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type CatalogProduct = {
  id: string;
  product_type: "physical" | "digital";
};

type PreviewRow = {
  product_id: string;
  status: DigitalPreviewStatus;
  source_asset_version_id: string | null;
  public_preview_path: string | null;
  is_merchant_override: boolean;
  failure_reason: string | null;
};

export type DigitalCatalogPreview = {
  status: DigitalPreviewStatus;
  sourceAssetVersionId: string | null;
  publicUrl: string | null;
  isMerchantOverride: boolean;
  failureReason: string | null;
};

export async function enrichDigitalCatalogProducts<T extends CatalogProduct>(input: {
  admin: AdminClient;
  storeId: string;
  products: T[];
}): Promise<Array<T & { digital_readiness: DigitalProductReadiness | null; digital_preview: DigitalCatalogPreview | null }>> {
  const digitalProducts = input.products.filter((product) => product.product_type === "digital");
  if (digitalProducts.length === 0) {
    return input.products.map((product) => ({ ...product, digital_readiness: null, digital_preview: null }));
  }

  const productIds = digitalProducts.map((product) => product.id);
  const [readinessEntries, previewResult] = await Promise.all([
    Promise.all(digitalProducts.map(async (product) => [
      product.id,
      await loadDigitalProductReadiness({
        admin: input.admin as unknown as ReadinessAdminClient,
        storeId: input.storeId,
        productId: product.id,
      }),
    ] as const)),
    input.admin
      .from("digital_product_previews")
      .select("product_id,status,source_asset_version_id,public_preview_path,is_merchant_override,failure_reason")
      .eq("store_id", input.storeId)
      .in("product_id", productIds)
      .returns<PreviewRow[]>(),
  ]);

  if (previewResult.error) throw new Error("Unable to load digital product previews.");
  const readinessByProduct = new Map(readinessEntries);
  const previewByProduct = new Map((previewResult.data ?? []).map((preview) => {
    const publicUrl = preview.public_preview_path
      ? input.admin.storage.from(DIGITAL_PREVIEW_BUCKET).getPublicUrl(preview.public_preview_path).data.publicUrl
      : null;
    return [preview.product_id, {
      status: preview.status,
      sourceAssetVersionId: preview.source_asset_version_id,
      publicUrl,
      isMerchantOverride: preview.is_merchant_override,
      failureReason: preview.failure_reason,
    } satisfies DigitalCatalogPreview] as const;
  }));

  return input.products.map((product) => ({
    ...product,
    digital_readiness: product.product_type === "digital" ? readinessByProduct.get(product.id) ?? null : null,
    digital_preview: product.product_type === "digital"
      ? previewByProduct.get(product.id) ?? {
          status: "missing",
          sourceAssetVersionId: null,
          publicUrl: null,
          isMerchantOverride: false,
          failureReason: null,
        }
      : null,
  }));
}
