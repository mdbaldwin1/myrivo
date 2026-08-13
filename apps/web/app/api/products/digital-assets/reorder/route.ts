import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AssetLifecycleError, reorderAssets } from "@/lib/digital-products/asset-service";
import { DIGITAL_PRODUCT_CONFIG } from "@/lib/digital-products/config";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z
  .object({
    productId: z.string().uuid(),
    assetIds: z
      .array(z.string().uuid())
      .max(DIGITAL_PRODUCT_CONFIG.maxFilesPerProduct),
  })
  .strict()
  .refine((value) => new Set(value.assetIds).size === value.assetIds.length, {
    path: ["assetIds"],
    message: "Asset ids must be unique",
  });

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
  try {
    const result = await reorderAssets({
      admin: createSupabaseAdminClient(),
      storeId: bundle.store.id,
      productId: parsed.data.productId,
      assetIds: parsed.data.assetIds,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AssetLifecycleError) {
      return NextResponse.json({ error: error.publicMessage }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to reorder files." }, { status: 500 });
  }
}
