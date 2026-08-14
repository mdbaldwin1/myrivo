import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AssetLifecycleError, createAssetUploadIntent } from "@/lib/digital-products/asset-service";
import { resolveStoreDigitalProductsAccess } from "@/lib/digital-products/feature-gating";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z
  .object({
    productId: z.string().uuid(),
    productVariantId: z.string().uuid().nullable().optional(),
    label: z.string().trim().min(1).max(160),
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(100),
    sizeBytes: z.number().int().positive(),
  })
  .strict();

export async function POST(request: NextRequest) {
  const originFailure = enforceTrustedOrigin(request);
  if (originFailure) return originFailure;
  const parsed = await parseJsonRequest(request, schema);
  if (!parsed.ok) return parsed.response;
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bundle = await getOwnedStoreBundle(user.id, "staff");
  if (!bundle) return NextResponse.json({ error: "Store unavailable." }, { status: 404 });
  const admin = createSupabaseAdminClient();
  const access = await resolveStoreDigitalProductsAccess(admin, bundle.store.id).catch(() => ({ enabled: false }));
  if (!access.enabled) return NextResponse.json({ error: "Digital products are not enabled for this store." }, { status: 403 });

  try {
    const result = await createAssetUploadIntent({
      admin,
      storeId: bundle.store.id,
      productId: parsed.data.productId,
      productVariantId: parsed.data.productVariantId ?? null,
      label: parsed.data.label,
      fileName: parsed.data.fileName,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AssetLifecycleError) {
      return NextResponse.json({ error: error.publicMessage }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to prepare upload." }, { status: 500 });
  }
}
