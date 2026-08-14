import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  AssetLifecycleError,
  removeAsset,
  retryAssetUpload,
  updateAsset,
} from "@/lib/digital-products/asset-service";
import { resolveStoreDigitalProductsAccess } from "@/lib/digital-products/feature-gating";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function authorize() {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  return user ? getOwnedStoreBundle(user.id, "staff") : null;
}

function lifecycleFailure(error: unknown) {
  if (error instanceof AssetLifecycleError) {
    return NextResponse.json({ error: error.publicMessage }, { status: error.status });
  }
  return NextResponse.json({ error: "Unable to update this file." }, { status: 500 });
}

export async function GET(request: NextRequest) {
  const bundle = await authorize();
  if (!bundle) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const productId = request.nextUrl.searchParams.get("productId");
  if (!z.string().uuid().safeParse(productId).success) {
    return NextResponse.json({ error: "Invalid product." }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  const access = await resolveStoreDigitalProductsAccess(admin, bundle.store.id).catch(() => ({ enabled: false }));
  if (!access.enabled) return NextResponse.json({ error: "Digital products are not enabled for this store." }, { status: 403 });
  const { data, error } = await admin
    .from("digital_product_assets")
    .select(
      "id,label,product_variant_id,sort_order,active,digital_product_asset_versions(id,customer_filename,mime_type,byte_size,status,failure_reason,version_number,created_at,retired_at)",
    )
    .eq("store_id", bundle.store.id)
    .eq("product_id", productId!)
    .eq("active", true)
    .order("sort_order");
  if (error) return NextResponse.json({ error: "Unable to load files." }, { status: 500 });
  const { data: failedUploads, error: failedUploadsError } = await admin
    .from("digital_asset_upload_intents")
    .select(
      "id,asset_id,operation,label,expected_filename,expected_mime_type,expected_byte_size,product_variant_id,last_safe_error,version_number,updated_at",
    )
    .eq("store_id", bundle.store.id)
    .eq("product_id", productId!)
    .eq("status", "failed")
    .order("updated_at", { ascending: false });
  if (failedUploadsError) return NextResponse.json({ error: "Unable to load failed uploads." }, { status: 500 });
  return NextResponse.json({ assets: data ?? [], failedUploads: failedUploads ?? [] });
}

const updateSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("update"),
      assetId: z.string().uuid(),
      label: z.string().trim().min(1).max(160).optional(),
      productVariantId: z.string().uuid().nullable().optional(),
    })
    .strict()
    .refine((value) => value.label !== undefined || value.productVariantId !== undefined),
  z.object({ action: z.literal("retry"), intentId: z.string().uuid() }).strict(),
]);

export async function PATCH(request: NextRequest) {
  const originFailure = enforceTrustedOrigin(request);
  if (originFailure) return originFailure;
  const parsed = await parseJsonRequest(request, updateSchema);
  if (!parsed.ok) return parsed.response;
  const bundle = await authorize();
  if (!bundle) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createSupabaseAdminClient();
  const access = await resolveStoreDigitalProductsAccess(admin, bundle.store.id).catch(() => ({ enabled: false }));
  if (!access.enabled) return NextResponse.json({ error: "Digital products are not enabled for this store." }, { status: 403 });
  try {
    const result =
      parsed.data.action === "retry"
        ? await retryAssetUpload({
            admin,
            storeId: bundle.store.id,
            intentId: parsed.data.intentId,
          })
        : await updateAsset({
            admin,
            storeId: bundle.store.id,
            assetId: parsed.data.assetId,
            label: parsed.data.label,
            productVariantId: parsed.data.productVariantId,
          });
    return NextResponse.json(result);
  } catch (error) {
    return lifecycleFailure(error);
  }
}

const removeSchema = z.object({ assetId: z.string().uuid() }).strict();

export async function DELETE(request: NextRequest) {
  const originFailure = enforceTrustedOrigin(request);
  if (originFailure) return originFailure;
  const parsed = await parseJsonRequest(request, removeSchema);
  if (!parsed.ok) return parsed.response;
  const bundle = await authorize();
  if (!bundle) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createSupabaseAdminClient();
  const access = await resolveStoreDigitalProductsAccess(admin, bundle.store.id).catch(() => ({ enabled: false }));
  if (!access.enabled) return NextResponse.json({ error: "Digital products are not enabled for this store." }, { status: 403 });
  try {
    const result = await removeAsset({
      admin,
      storeId: bundle.store.id,
      assetId: parsed.data.assetId,
    });
    return NextResponse.json(result);
  } catch (error) {
    return lifecycleFailure(error);
  }
}
