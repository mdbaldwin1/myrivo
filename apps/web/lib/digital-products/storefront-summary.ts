import { DIGITAL_PREVIEW_BUCKET } from "@/lib/digital-products/assets";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type PreviewRow = {
  product_id: string;
  public_preview_path: string | null;
};

type AssetVersionRow = {
  mime_type: string;
  status: string;
  version_number: number;
  retired_at: string | null;
};

type AssetRow = {
  product_id: string;
  product_variant_id: string | null;
  label: string;
  sort_order: number;
  digital_product_asset_versions: AssetVersionRow | AssetVersionRow[] | null;
};

export type StorefrontDigitalSummary = {
  publicPreviewUrl: string | null;
  files: Array<{
    variantId: string | null;
    label: string;
    format: string;
  }>;
};

function displayFormat(mimeType: string) {
  const subtype = mimeType.split("/").at(-1)?.toLowerCase() ?? "file";
  return subtype === "jpeg" ? "JPG" : subtype.toUpperCase();
}

function latestReadyVersion(value: AssetRow["digital_product_asset_versions"]) {
  const versions = Array.isArray(value) ? value : value ? [value] : [];
  return versions
    .filter((version) => version.status === "ready" && version.retired_at === null)
    .sort((left, right) => right.version_number - left.version_number)[0] ?? null;
}

export async function enrichStorefrontDigitalProducts<
  T extends { id: string; product_type?: "physical" | "digital" }
>({
  admin,
  storeId,
  products
}: {
  admin: AdminClient;
  storeId: string;
  products: T[];
}): Promise<Array<T & { digital_summary: StorefrontDigitalSummary | null }>> {
  const digitalProductIds = products
    .filter(({ product_type }) => product_type === "digital")
    .map(({ id }) => id);

  if (digitalProductIds.length === 0) {
    return products.map((product) => ({ ...product, digital_summary: null }));
  }

  const [previewResult, assetResult] = await Promise.all([
    admin
      .from("digital_product_previews")
      .select("product_id,public_preview_path")
      .eq("store_id", storeId)
      .eq("status", "ready")
      .in("product_id", digitalProductIds)
      .returns<PreviewRow[]>(),
    admin
      .from("digital_product_assets")
      .select("product_id,product_variant_id,label,sort_order,digital_product_asset_versions(mime_type,status,version_number,retired_at)")
      .eq("store_id", storeId)
      .eq("active", true)
      .in("product_id", digitalProductIds)
      .order("sort_order", { ascending: true })
      .returns<AssetRow[]>()
  ]);

  if (previewResult.error || assetResult.error) {
    throw new Error("Unable to load digital product details.");
  }

  const previewPathByProduct = new Map(
    (previewResult.data ?? []).map((preview) => [preview.product_id, preview.public_preview_path] as const)
  );
  const filesByProduct = new Map<string, StorefrontDigitalSummary["files"]>();
  for (const asset of assetResult.data ?? []) {
    const version = latestReadyVersion(asset.digital_product_asset_versions);
    if (!version) continue;
    const files = filesByProduct.get(asset.product_id) ?? [];
    files.push({
      variantId: asset.product_variant_id,
      label: asset.label,
      format: displayFormat(version.mime_type)
    });
    filesByProduct.set(asset.product_id, files);
  }

  return products.map((product) => {
    if (product.product_type !== "digital") {
      return { ...product, digital_summary: null };
    }
    const previewPath = previewPathByProduct.get(product.id) ?? null;
    return {
      ...product,
      digital_summary: {
        publicPreviewUrl: previewPath
          ? admin.storage.from(DIGITAL_PREVIEW_BUCKET).getPublicUrl(previewPath).data.publicUrl
          : null,
        files: filesByProduct.get(product.id) ?? []
      }
    };
  });
}
