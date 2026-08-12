import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildDigitalAssetStoragePath, DIGITAL_ASSET_BUCKET, newDigitalAssetId, validateDigitalAssetUpload } from "@/lib/digital-products/assets";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ productId: z.string().uuid(), fileName: z.string().min(1).max(255), mimeType: z.string(), sizeBytes: z.number().int().positive() });

export async function POST(request: NextRequest) {
  const originFailure = enforceTrustedOrigin(request);
  if (originFailure) return originFailure;
  const parsed = await parseJsonRequest(request, schema);
  if (!parsed.ok) return parsed.response;
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bundle = await getOwnedStoreBundle(user.id, "staff");
  if (!bundle) return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  const check = validateDigitalAssetUpload(parsed.data);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: product } = await admin.from("products").select("id").eq("id", parsed.data.productId).eq("store_id", bundle.store.id).maybeSingle();
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  const assetId = newDigitalAssetId();
  const storagePath = buildDigitalAssetStoragePath({ storeId: bundle.store.id, productId: product.id, assetId, version: 1, fileName: parsed.data.fileName });
  const { data, error } = await admin.storage.from(DIGITAL_ASSET_BUCKET).createSignedUploadUrl(storagePath);
  if (error || !data?.signedUrl) return NextResponse.json({ error: error?.message ?? "Unable to create upload URL" }, { status: 500 });
  return NextResponse.json({ assetId, storagePath, uploadUrl: data.signedUrl, token: data.token }, { status: 201 });
}
