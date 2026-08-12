import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";
import { buildWatermarkSvg, DIGITAL_ASSET_BUCKET, DIGITAL_PREVIEW_BUCKET } from "@/lib/digital-products/assets";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ assetId: z.string().uuid(), productId: z.string().uuid(), storagePath: z.string().min(1), fileName: z.string().min(1).max(255), label: z.string().min(1).max(160), mimeType: z.enum(["image/jpeg", "image/png", "application/pdf", "application/zip"]), variantId: z.string().uuid().nullable().optional() });

export async function POST(request: NextRequest) {
  const originFailure = enforceTrustedOrigin(request);
  if (originFailure) return originFailure;
  const parsed = await parseJsonRequest(request, schema);
  if (!parsed.ok) return parsed.response;
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bundle = await getOwnedStoreBundle(user.id, "staff");
  if (!bundle || !parsed.data.storagePath.startsWith(`${bundle.store.id}/${parsed.data.productId}/${parsed.data.assetId}/`)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const admin = createSupabaseAdminClient();
  const { data: product } = await admin.from("products").select("id,image_urls").eq("id", parsed.data.productId).eq("store_id", bundle.store.id).maybeSingle();
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  const { data: downloaded, error: downloadError } = await admin.storage.from(DIGITAL_ASSET_BUCKET).download(parsed.data.storagePath);
  if (downloadError || !downloaded) return NextResponse.json({ error: downloadError?.message ?? "Uploaded file not found" }, { status: 400 });
  const bytes = Buffer.from(await downloaded.arrayBuffer());
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const { error: assetError } = await admin.from("digital_product_assets").insert({ id: parsed.data.assetId, store_id: bundle.store.id, product_id: product.id, product_variant_id: parsed.data.variantId ?? null, label: parsed.data.label });
  if (assetError) return NextResponse.json({ error: assetError.message }, { status: 500 });
  const { data: version, error: versionError } = await admin.from("digital_product_asset_versions").insert({ asset_id: parsed.data.assetId, version_number: 1, storage_path: parsed.data.storagePath, customer_filename: parsed.data.fileName, mime_type: parsed.data.mimeType, byte_size: bytes.length, checksum_sha256: checksum, status: "ready" }).select("id").single();
  if (versionError || !version) return NextResponse.json({ error: versionError?.message ?? "Unable to save file" }, { status: 500 });

  let previewUrl: string | null = null;
  if (parsed.data.mimeType.startsWith("image/")) {
    const image = sharp(bytes).rotate().resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true });
    const metadata = await image.metadata();
    const width = metadata.width ?? 1000;
    const height = metadata.height ?? 1000;
    const preview = await image.composite([{ input: buildWatermarkSvg(bundle.store.name, width, height), blend: "over" }]).jpeg({ quality: 78 }).toBuffer();
    const previewPath = `${bundle.store.id}/${product.id}/watermarked-${version.id}.jpg`;
    const { error: previewError } = await admin.storage.from(DIGITAL_PREVIEW_BUCKET).upload(previewPath, preview, { contentType: "image/jpeg", upsert: true });
    if (!previewError) {
      previewUrl = admin.storage.from(DIGITAL_PREVIEW_BUCKET).getPublicUrl(previewPath).data.publicUrl;
      await admin.from("digital_product_previews").upsert({ product_id: product.id, source_asset_version_id: version.id, public_preview_path: previewPath, status: "ready", is_merchant_override: false });
      if (!product.image_urls?.length) await admin.from("products").update({ image_urls: [previewUrl] }).eq("id", product.id);
    }
  }
  return NextResponse.json({ assetId: parsed.data.assetId, versionId: version.id, previewUrl }, { status: 201 });
}
